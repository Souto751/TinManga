// Config plugin de Expo: hace que `expo prebuild` deje el
// android/app/build.gradle generado listo para firmar los builds de
// release con un keystore propio, en vez de con el debug.keystore
// "de la nada" que Android/Gradle usan por defecto.
//
// No hardcodea ningún secreto acá. Lee 4 propiedades de Gradle
// (definidas en ~/.gradle/gradle.properties local, o inyectadas por el
// workflow de GitHub Actions) y arma un signingConfigs.release con eso:
//
//   TINMANGAS_RELEASE_STORE_FILE
//   TINMANGAS_RELEASE_STORE_PASSWORD
//   TINMANGAS_RELEASE_KEY_ALIAS
//   TINMANGAS_RELEASE_KEY_PASSWORD
//
// Si esas propiedades no están definidas en la máquina donde se compila,
// el build.gradle generado sigue firmando con signingConfigs.debug como
// hasta ahora (no rompe nada en una PC que todavía no configuró esto).
//
// Ver RELEASES.md para cómo generar/reusar el keystore y cargar estas
// variables.

const { withAppBuildGradle } = require('expo/config-plugins');

const MARKER = '// tinmangas-release-signing';

function withReleaseSigning(config) {
  return withAppBuildGradle(config, (config) => {
    let contents = config.modResults.contents;

    if (contents.includes(MARKER)) {
      // Ya aplicado (por ejemplo, un segundo plugin corriendo dos veces).
      return config;
    }

    const releaseSigningConfig = `
        release {
            ${MARKER}
            if (project.hasProperty('TINMANGAS_RELEASE_STORE_FILE')) {
                storeFile file(TINMANGAS_RELEASE_STORE_FILE)
                storePassword TINMANGAS_RELEASE_STORE_PASSWORD
                keyAlias TINMANGAS_RELEASE_KEY_ALIAS
                keyPassword TINMANGAS_RELEASE_KEY_PASSWORD
            }
        }
`;

    if (!/signingConfigs\s*\{/.test(contents)) {
      throw new Error(
        'withReleaseSigning: no se encontró el bloque signingConfigs { } en android/app/build.gradle. ' +
          'Revisá plugins/withReleaseSigning.js, puede que el template de Expo haya cambiado.',
      );
    }

    contents = contents.replace(/signingConfigs\s*\{/, (match) => `${match}\n${releaseSigningConfig}`);

    // Si hay un keystore de release configurado, usarlo para el buildType
    // release; si no, seguir con signingConfigs.debug (comportamiento
    // actual, sin romper nada).
    const buildTypePattern = /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/;
    if (!buildTypePattern.test(contents)) {
      throw new Error(
        'withReleaseSigning: no se encontró "signingConfig signingConfigs.debug" dentro de buildTypes.release ' +
          'en android/app/build.gradle. El template de Expo puede haber cambiado; revisá plugins/withReleaseSigning.js ' +
          '(si no se corrige esto, el build de release sigue firmando con el keystore de debug de la máquina que compila).',
      );
    }
    contents = contents.replace(
      buildTypePattern,
      `$1signingConfig project.hasProperty('TINMANGAS_RELEASE_STORE_FILE') ? signingConfigs.release : signingConfigs.debug`,
    );

    config.modResults.contents = contents;
    return config;
  });
}

module.exports = withReleaseSigning;
