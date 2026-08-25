// Config dinámica de Expo. Reemplaza a app.json (ver app.json.bak).
//
// Por qué existe: para poder compilar una variante "dev" que se instale
// AL LADO de la app de producción en el celular, sin pisarla. Al tener
// distinto package (com.personal.lectorcbr.dev) Android la trata como una
// app totalmente distinta, así que conviven sin el error
// INSTALL_FAILED_UPDATE_INCOMPATIBLE ni tocar el progreso/lista guardados
// por la instalación "real".
//
// Uso:
//   Build normal (producción, como siempre):
//     npx expo prebuild -p android --clean
//
//   Build de prueba en paralelo (no pisa la app instalada):
//     Windows PowerShell:
//       $env:APP_VARIANT="development"; npx expo prebuild -p android --clean
//     luego compilás/instalás como siempre (android\gradlew assembleDebug, etc.)
//
// TINMANGAS_VERSION / TINMANGAS_VERSION_CODE los setea el workflow de CI
// (.github/workflows/release.yml) para no depender de jq parcheando un
// app.json estático. Local, sin esas env vars, usa los valores de siempre.

const IS_DEV = process.env.APP_VARIANT === 'development';

const VERSION = process.env.TINMANGAS_VERSION || '1.0.0';
const VERSION_CODE = process.env.TINMANGAS_VERSION_CODE
  ? parseInt(process.env.TINMANGAS_VERSION_CODE, 10)
  : 16;

module.exports = {
  expo: {
    name: IS_DEV ? 'TinMangas (Dev)' : 'TinMangas',
    slug: 'tinmangas',
    version: VERSION,
    orientation: 'default',
    icon: './assets/icon.png',
    userInterfaceStyle: 'dark',
    androidStatusBar: { backgroundColor: '#07070E', barStyle: 'light-content' },
    androidNavigationBar: { backgroundColor: '#07070E', barStyle: 'light-content' },
    ios: { supportsTablet: true },
    android: {
      package: IS_DEV ? 'com.personal.lectorcbr.dev' : 'com.personal.lectorcbr',
      versionCode: VERSION_CODE,
      adaptiveIcon: {
        backgroundColor: '#07070E',
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
      permissions: ['android.permission.REQUEST_INSTALL_PACKAGES'],
    },
    web: { favicon: './assets/favicon.png' },
    plugins: ['./plugins/withReleaseSigning.js'],
  },
};
