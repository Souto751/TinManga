# Auto-actualización y releases

Cómo quedó armado el chequeo de "hay una versión nueva" y qué falta configurar
a mano (una sola vez) para que funcione de punta a punta.

## Qué hace la app ahora

- Al abrir la app (y con un botón manual en **Ajustes → Actualizaciones**),
  consulta el último release de `https://github.com/Souto751/TinManga`.
- Si ese release trae un `versionCode` más alto que el instalado, muestra un
  aviso arriba de la pantalla con un botón **Actualizar**.
- Al tocarlo, descarga el `.apk` del release y abre el instalador de Android.
  **Eso sí lo tenés que confirmar vos**: Android no deja instalar nada fuera
  de Play Store sin que el usuario toque "Instalar" (ver más abajo el permiso
  de "orígenes desconocidos").

Como el repo es **privado** (lo van a usar conocidos, no querés que quede
público), todos esos pedidos van con un token de solo lectura — ver la
sección 4 más abajo.

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

## 4. Token de lectura para el repo privado

Como el repo no es público, la app necesita credenciales para poder leer
`releases/latest` y descargar los assets. Usamos un **fine-grained personal
access token** de GitHub, limitado nada más a este repo y de solo lectura —
no da acceso a nada más de tu cuenta ni permite escribir.

### Generarlo

1. En GitHub: tu foto de perfil → **Settings** → (al final del menú
   izquierdo) **Developer settings** → **Personal access tokens** →
   **Fine-grained tokens** → **Generate new token**.
2. **Repository access**: "Only select repositories" → elegí `TinManga`.
3. **Permissions → Repository permissions → Contents**: `Read-only`. No
   hace falta ningún otro permiso.
4. **Expiration**: a gusto. Con "No expiration" no tenés que acordarte de
   renovarlo, pero tené en cuenta que si alguna vez lo revocás o cambiás,
   las apps que ya instalaron tus conocidos van a dejar de poder chequear
   actualizaciones hasta que les pases una build nueva (el token queda
   incluido dentro de cada `.apk` al compilarlo, no se pide en vivo).
5. Generá el token y copialo — GitHub te lo muestra una sola vez.

### Usarlo en tu build local

Copiá `.env.example` a `.env` (ese archivo queda gitignoreado, nunca se
commitea) y completá el token:

```bash
cp .env.example .env
```

```
EXPO_PUBLIC_GITHUB_TOKEN=github_pat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Usarlo en GitHub Actions

Mismo lugar que los secrets del keystore — **Settings → Secrets and
variables → Actions → New repository secret**:

| Secret | Valor |
|---|---|
| `RELEASE_READ_TOKEN` | el mismo token de arriba |

El workflow lo escribe en un `.env` propio dentro del runner antes de
compilar (paso "Configurar token de lectura para GitHub").

## 5. Instalar las dependencias nuevas

Estos dos paquetes JS no estaban en el proyecto; hay que agregarlos (esto
también fija la versión correcta para el SDK 57):

```bash
npx expo install expo-intent-launcher expo-constants
```

Después de eso, `npx tsc --noEmit` debería pasar limpio. Si algo de la API
de `expo-file-system`/`expo-intent-launcher` cambió respecto a lo que se usó
acá (`src/update/updater.ts`), va a saltar como error de tipos ahí mismo.

## 6. Publicar una versión nueva

### Con el script (recomendado)

Una vez que los secrets están cargados, `scripts/publish.ps1` hace todo el
flujo de golpe: chequea que no quede un `.git\index.lock` colgado ni el
`.env` trackeado por git, te muestra el `git status` para que confirmes,
corre `npx tsc --noEmit`, calcula solo el próximo número de versión (patch/
minor/major) mirando el último tag, y recién ahí commitea, taguea y
pushea.

```powershell
# Arreglo (bugfix) — sube el patch, ej. v1.9.0 -> v1.9.1
.\scripts\publish.ps1

# Función nueva — sube el minor, ej. v1.9.0 -> v1.10.0
.\scripts\publish.ps1 -Bump minor -Message "Modo online/offline + idioma de MangaDex"

# Versión puntual a mano, ignora el cálculo automático
.\scripts\publish.ps1 -Version 2.0.0 -Message "Rediseño completo"
```

Te va a pedir confirmación dos veces (después de mostrarte el `git status`,
y de nuevo antes de pushear), así que no hay riesgo de que se dispare solo.
Si en algún momento PowerShell te bloquea la ejecución de scripts, corré una
vez `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` y confirmá.

### A mano

Si preferís hacerlo paso a paso vos mismo (o el script no te sirve por
algún motivo):

```bash
git add -A
git commit -m "Auto-actualización + firma reproducible"
git tag v1.8.0
git push origin master --tags
```

El push del tag dispara `.github/workflows/release.yml`, que:

1. Calcula `version`/`versionCode` a partir del tag (versionCode = `1000 +
   número de run`, así siempre queda por encima del `16` actual) y se los
   pasa a `app.config.js` como variables de entorno (`TINMANGAS_VERSION` /
   `TINMANGAS_VERSION_CODE`).
2. Compila el APK firmado con el keystore de los secrets.
3. Publica un GitHub Release con el `.apk` y un `latest.json` (lo que lee la
   app para saber la versión disponible).

Para la siguiente versión, repetís: subís los cambios, `git tag v1.8.1`,
`git push --tags`. No hace falta tocar `versionCode` a mano nunca más.

## 7. Primera vez que se instala una actualización en el celular

Android va a pedir permiso para "instalar apps desconocidas" para TinMangas
la primera vez que se use el botón **Actualizar** (es el permiso
`REQUEST_INSTALL_PACKAGES` que ya se agregó a `app.json`). Es un permiso que
se otorga una sola vez por app, no por versión.

## 8. Build de prueba (dev) sin pisar la app instalada

Desde que la config pasó a `app.config.js`, existe una variante **dev** que
se instala como una app aparte (`com.personal.lectorcbr.dev`, se llama
"TinMangas (Dev)"), separada de la instalación real que ya tenés (y que
usan los conocidos). Sirve para probar builds nuevas sin arriesgar el
progreso guardado ni la app que otros están usando.

`app.json` quedó reemplazado por `app.config.js` (que lee `APP_VARIANT` del
entorno). Si todavía tenés el `app.json` viejo dando vueltas, se puede
borrar o renombrar — Expo usa `app.config.js` y lo ignora.

### Generar el build dev

PowerShell:

```powershell
$env:APP_VARIANT="development"
npx expo prebuild -p android --clean
cd android
.\gradlew assembleDebug
```

Esto regenera `/android` con `applicationId com.personal.lectorcbr.dev` y el
nombre "TinMangas (Dev)". El APK queda en
`android\app\build\outputs\apk\debug\app-debug.apk` — se instala con
`adb install -r app-debug.apk` (o mandándolo al celular a mano) igual que
siempre, pero al tener otro `applicationId` Android lo trata como una app
distinta: convive con la real, no pisa nada, y no hace falta preocuparse
por la firma (usa el `debug.keystore` de siempre, no el de release).

### Volver a compilar la versión real

Importante: `$env:APP_VARIANT` queda seteada en esa terminal hasta que la
cerrés. Para volver a compilar la app de producción en la misma sesión de
PowerShell:

```powershell
Remove-Item Env:APP_VARIANT
npx expo prebuild -p android --clean
```

O simplemente abrí una terminal nueva (sin la variable seteada, `expo
prebuild` arma la versión de producción por defecto). El workflow de GitHub
Actions nunca setea `APP_VARIANT`, así que los releases publicados siempre
son la app de producción — la variante dev es solo para instalar a mano en
tu celular mientras probás.

## Troubleshooting

- **`INSTALL_FAILED_UPDATE_INCOMPATIBLE`**: el APK nuevo está firmado con
  una clave distinta a la instalada. Revisá que los secrets de GitHub y tu
  `gradle.properties` local apunten al mismo `debug.keystore` (paso 1-3). Si
  la app que ya tenías instalada en un celular se compiló en otra PC (con
  otro `debug.keystore` que ya no tenés), no hay forma de "arreglar" la
  firma sin perder esa instalación — hay que desinstalarla una vez e
  instalar la nueva ya firmada consistente; de ahí en adelante no vuelve a
  pasar.
- **"Buscar actualizaciones" tira "GitHub respondió 404"**: como el repo es
  privado, esto pasa si el token no está bien cargado. Revisá que exista
  `EXPO_PUBLIC_GITHUB_TOKEN` en el `.env` con el que se compiló ese APK
  puntual (paso 4) — si armaste el build sin el `.env`, o el token no tiene
  acceso al repo, la API devuelve 404 en vez de un error más claro (es
  cómo responde GitHub para no confirmar la existencia de un repo privado
  sin credenciales).
- **El banner nunca aparece pero el chequeo manual no tira error**: puede
  ser que ya estés al día, o que hayas descartado ese aviso antes (tocaste
  la ✕) — el descarte queda guardado por versión, así que no vuelve a
  aparecer solo hasta que salga una versión más nueva. Probá el botón
  manual en Ajustes, que además te confirma con un cartel si estás al día.
- **El workflow falla en "Compilar APK de release"**: es el mismo
  `gradlew assembleRelease` que ya usabas a mano, corriendo en un runner
  Linux de GitHub en vez de tu PC — si el módulo nativo `native-unrar`
  necesita algo específico de Windows que no esté en el repo, va a fallar
  acá y hay que ajustarlo (revisar el log del step).
