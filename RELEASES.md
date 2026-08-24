# Auto-actualización y releases

Cómo quedó armado el chequeo de "hay una versión nueva" y qué falta configurar
a mano (una sola vez) para que funcione de punta a punta.

## Qué hace la app ahora

- Al abrir la app (y con un botón manual en **Ajustes → Actualizaciones**),
  consulta el último release público de
  `https://github.com/Souto751/TinManga/releases/latest`.
- Si ese release trae un `versionCode` más alto que el instalado, muestra un
  aviso arriba de la pantalla con un botón **Actualizar**.
- Al tocarlo, descarga el `.apk` del release y abre el instalador de Android.
  **Eso sí lo tenés que confirmar vos**: Android no deja instalar nada fuera
  de Play Store sin que el usuario toque "Instalar" (ver más abajo el permiso
  de "orígenes desconocidos").

Código relevante: `src/update/updater.ts`, `src/context/AppContext.tsx`,
`src/components/UpdateBanner.tsx`, sección nueva en
`src/screens/SettingsScreen.tsx`.

## ⚠️ Lo más importante: la firma del APK

Android no te deja instalar una app "encima" de otra con el mismo paquete si
está firmada con una clave distinta — te va a tirar
`INSTALL_FAILED_UPDATE_INCOMPATIBLE` y vas a tener que desinstalar la app
vieja primero (y ahí perdés el progreso, porque `lectorcbr.json` vive en el
almacenamiento privado de la app).

Hoy, `gradlew assembleRelease` sin configuración extra firma con el
**debug.keystore de tu PC** (es el comportamiento por defecto que trae el
template de Android/Expo: `signingConfig signingConfigs.debug` en el
`release` de `build.gradle`, que se regenera solo cada vez que corrés
`expo prebuild` porque `/android` está en `.gitignore`). Por eso hasta ahora
nunca tuviste el problema: siempre compilaste en la misma máquina, con el
mismo `debug.keystore`.

**Para que las actualizaciones automáticas no rompan la instalación actual,
lo más seguro es reusar ese mismo `debug.keystore`** como si fuera el
keystore "de release" de acá en adelante (perfectamente válido para una app
personal que no va a Play Store). Así:

- Los APKs que arme GitHub Actions quedan firmados igual que el que ya tenés
  instalado en el celular.
- No hace falta desinstalar nada ni perder progreso.
- No hay que generar ni cuidar un keystore nuevo.

### 1. Encontrar tu debug.keystore

En la PC donde veías compilando hasta ahora (Windows):

```powershell
dir "$env:USERPROFILE\.android\debug.keystore"
```

Si existe, es ese archivo. La contraseña del keystore, el alias y la
contraseña de la clave son siempre los mismos por defecto en las
herramientas de Android (no dependen de tu máquina):

```
storePassword: android
keyAlias:      androiddebugkey
keyPassword:   android
```

Podés confirmarlo con:

```powershell
keytool -list -v -keystore "$env:USERPROFILE\.android\debug.keystore" -storepass android
```

Tiene que listar un alias `androiddebugkey`.

### 2. Configurar el build local para usar ese keystore

Creá (o editá) `%USERPROFILE%\.gradle\gradle.properties` y agregá:

```properties
TINMANGAS_RELEASE_STORE_FILE=C:/Users/<tu usuario>/.android/debug.keystore
TINMANGAS_RELEASE_STORE_PASSWORD=android
TINMANGAS_RELEASE_KEY_ALIAS=androiddebugkey
TINMANGAS_RELEASE_KEY_PASSWORD=android
```

(usá `/` aunque estés en Windows, Gradle lo entiende bien igual). El plugin
nuevo `plugins/withReleaseSigning.js` hace que cada `expo prebuild` deje el
`android/app/build.gradle` generado leyendo estas variables. Si no están
definidas, sigue firmando con `signingConfigs.debug` como hasta ahora — no
rompe nada en una PC que todavía no configuró esto.

Con esto, tu flujo local de siempre (`expo prebuild -p android` +
`gradlew assembleRelease`) sigue funcionando igual, pero ya firmado con el
keystore "de release".

### 3. Cargar el mismo keystore en GitHub Actions

En una PC con `bash` (o Git Bash en Windows), generá el base64 del mismo
archivo:

```bash
base64 -w0 "$USERPROFILE/.android/debug.keystore" > keystore.b64
```

En GitHub: **Settings → Secrets and variables → Actions → New repository
secret**, y cargá estos 4 secrets:

| Secret | Valor |
|---|---|
| `RELEASE_KEYSTORE_BASE64` | contenido de `keystore.b64` |
| `RELEASE_STORE_PASSWORD` | `android` |
| `RELEASE_KEY_ALIAS` | `androiddebugkey` |
| `RELEASE_KEY_PASSWORD` | `android` |

Borrá `keystore.b64` de tu disco después (no lo commitees).

> Si en algún momento decidís pasar a un keystore de verdad (por ejemplo si
> algún día publicás en Play Store), generás uno nuevo con `keytool
> -genkeypair`, actualizás los 4 secrets y las 4 propiedades locales — pero
> ese día vas a tener que reinstalar la app una vez porque cambia la firma.

## 4. Instalar las dependencias nuevas

Estos dos paquetes JS no estaban en el proyecto; hay que agregarlos (esto
también fija la versión correcta para el SDK 57):

```bash
npx expo install expo-intent-launcher expo-constants
```

Después de eso, `npx tsc --noEmit` debería pasar limpio. Si algo de la API
de `expo-file-system`/`expo-intent-launcher` cambió respecto a lo que se usó
acá (`src/update/updater.ts`), va a saltar como error de tipos ahí mismo.

## 5. Publicar una versión nueva

Una vez que los secrets están cargados:

```bash
git add -A
git commit -m "Auto-actualización + firma reproducible"
git tag v1.8.0
git push origin master --tags
```

El push del tag dispara `.github/workflows/release.yml`, que:

1. Bumpea `version`/`versionCode` en `app.json` (versionCode = `1000 +
   número de run`, así siempre queda por encima del `16` actual).
2. Compila el APK firmado con el keystore de los secrets.
3. Publica un GitHub Release con el `.apk` y un `latest.json` (lo que lee la
   app para saber la versión disponible).

Para la siguiente versión, repetís: subís los cambios, `git tag v1.8.1`,
`git push --tags`. No hace falta tocar `versionCode` a mano nunca más.

## 6. Primera vez que se instala una actualización en el celular

Android va a pedir permiso para "instalar apps desconocidas" para TinMangas
la primera vez que se use el botón **Actualizar** (es el permiso
`REQUEST_INSTALL_PACKAGES` que ya se agregó a `app.json`). Es un permiso que
se otorga una sola vez por app, no por versión.

## Troubleshooting

- **`INSTALL_FAILED_UPDATE_INCOMPATIBLE`**: el APK nuevo está firmado con
  una clave distinta a la instalada. Revisá que los secrets de GitHub y tu
  `gradle.properties` local apunten al mismo `debug.keystore` (paso 1-3).
- **El banner nunca aparece**: la API de GitHub para repos públicos permite
  60 pedidos sin autenticar por hora por IP; para uso personal no debería
  ser problema. Probá el botón manual en Ajustes, que muestra el error
  concreto si lo hay.
- **El workflow falla en "Compilar APK de release"**: es el mismo
  `gradlew assembleRelease` que ya usabas a mano, corriendo en un runner
  Linux de GitHub en vez de tu PC — si el módulo nativo `native-unrar`
  necesita algo específico de Windows que no esté en el repo, va a fallar
  acá y hay que ajustarlo (revisar el log del step).
