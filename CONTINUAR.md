# TinMangas — handoff para otra PC

Documento generado a partir del chat de Cursor (24 ago 2026).  
Objetivo: retomar el proyecto en otra máquina **sin perder contexto**.

**Este archivo no modifica la app.** Es bitácora + plan + prompt.

---

## Prompt para pegar en un chat nuevo

Copiá todo el bloque siguiente al iniciar Cursor en esta carpeta:

```text
Estás en el repo TinMangas (carpeta LectorCBR). Antes de tocar código, leé CONTINUAR.md y AGENTS.md.

Reglas fijas:
- Expo SDK 57. Docs: https://docs.expo.dev/versions/v57.0.0/
- App Android personal, package com.personal.lectorcbr, nombre visible TinMangas.
- Sin servidor propio, sin cuenta, sin base SQL. Estado en JSON local (lectorcbr.json).
- No romper el lector CBR/CBZ local ni el módulo nativo unrar.
- El tema oscuro no se reescribe; el claro es paleta aparte (lightColors).
- Entregar APK installable (assembleRelease) cuando el cambio sea de app, no solo de docs.

Estado actual: lector local de mangas (RTL por defecto, toggle manga/cómic), biblioteca por carpeta SAF, tapas, temas dark/light, icono con margen para máscara Android. versionCode 10.

Siguiente trabajo (acordado, aún NO implementado):
MangaDex API solo como vitrina + opcionalmente leer páginas online.
- Biblioteca local = CBR/CBZ de otras fuentes (ya funciona).
- Explorar = búsqueda/ficha/tapas en MangaDex.
- NO descargar tomos desde MangaDex a la carpeta de mangas.
- Uso personal: pocas peticiones, cachear, User-Agent propio.
- Credenciales OAuth (personal client) NO hacen falta para catálogo ni páginas; solo si más adelante se quieren follows.
- Las páginas de capítulo SÍ existen en la API (at-home), pero no vienen en la ficha: hay que pedir el chapter y después at-home.

Primera implementación pedida cuando el usuario diga “implementalo”:
1) Pestaña o pantalla Explorar (búsqueda + ficha).
2) Si se avanza a lectura online: abrir capítulo en el Reader actual con URLs de páginas, sin mezclar con extract.ts.
3) Progreso online con clave distinta (ej. md:{chapterId}), no pisar progress local por uri de archivo.

No implementes MangaDex hasta que te lo pida explícitamente. Si pregunto plan, respondé; si pido código, implementá fase por fase con APK.
```

---

## Qué es el proyecto

Lector Android **personal** de mangas/cómics en `.cbr`, `.cbz`, `.rar`, `.zip`.

| Dato | Valor |
|------|--------|
| Nombre visible | TinMangas |
| Package | `com.personal.lectorcbr` |
| Expo | SDK 57, RN 0.86, Hermes, New Architecture |
| versionCode actual | 10 |
| Progreso | `lectorcbr.json` en documentos de la app |
| APK de entrega | Escritorio: `TinMangas.apk` (y copia en la raíz del repo) |

No hay backend. La biblioteca es una carpeta del teléfono (Storage Access Framework).

Docs Expo: leer **siempre** https://docs.expo.dev/versions/v57.0.0/ (`AGENTS.md`).

---

## Cómo está armada la app

```
src/
  archive/     extraer CBR/CBZ (nativo 7zip + JSZip fallback)
  library/     escanear carpeta, tapas, agrupar series
  screens/     Library, Series, Reader, Settings
  storage/     lectorcbr.json
  context/     AppContext (config, colores, progreso)
  theme.ts     colors = oscuro (no tocar valores); lightColors = claro
modules/native-unrar/   Expo module Kotlin + 7-Zip-JBinding
```

Puntos frágiles ya resueltos:

- Hermes **no tiene WebAssembly**. `node-unrar-js` falló en APK. CBR va por módulo nativo `native-unrar`.
- El `build.gradle` del módulo nativo necesita `versionCode` y `versionName` o Expo autolinking falla.
- Nombres SAF tipo `primary:Manga` no deben mostrarse crudos; `friendlyFolderName` en `src/library/scan.ts`.
- Icono adaptive: el dibujo tiene que vivir en el centro (~52% del canvas) o Android recorta el libro.

Lectura manga:

- Default `readingDirection: 'rtl'`.
- Manga: avanzar a la derecha (tap izquierda / swipe derecha). Cómic: al revés.
- Slider nunca invertido: a la derecha avanza. Lista `inverted` en manga.
- Toggle en lector (MANGA / CÓMIC) y en Ajustes.

UI:

- Estética tinta / magenta `#FF2E8A` / cian, fuente Chakra Petch + DM Sans.
- Header biblioteca: kicker `ARCHIVO PERSONAL`, título `TINMANGAS`, botón `AJUSTES` a la derecha alineado al bloque.
- Tema claro: `config.colorScheme`, paleta `lightColors` (lila papel, **no blanco** en inputs/cards). Oscuro intacto.

Build APK (Windows, máquina original; en otra PC ajustar JAVA_HOME / SDK):

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_HOME = "C:\Users\consulta\AppData\Local\Android\Sdk"
cd android
.\gradlew.bat assembleRelease --no-daemon
```

Salida: `android/app/build/outputs/apk/release/app-release.apk`  
Package igual ⇒ se instala **encima** y conserva progreso.

`/android` está en `.gitignore`; en otra PC puede hacer falta `npx expo prebuild -p android` y volver a aplicar `largeHeap`, `app_name`, iconos mipmap y `versionCode` si prebuild pisa el nativo.

---

## Resumen del chat (lo ya hecho)

1. App Expo TS, catálogo por carpeta, lector, JSON de progreso.
2. Agrupar series por nombre tipo `Pandora Hearts - Tomo 01 (#001-004).cbr`; tapas por carpeta o archivo.
3. APK propio (no Expo Go).
4. Fix CBR: “property webassembly doesnt exist” → módulo nativo unrar.
5. RTL manga + toggle orientación.
6. Slider igual en manga (derecha = avanzar); swipe también.
7. UI más moderna, anime/HUD.
8. Rename a TinMangas.
9. Icono generado; margen extra para máscara del sistema (versionCode 10).
10. Quitar `primary:Manga` del header.
11. Header título + ajustes alineados; tema claro desde Ajustes.

---

## Plan MangaDex (acordado, sin código todavía)

### Producto

| Capa | Rol |
|------|-----|
| Biblioteca | CBR/CBZ de **otras fuentes**. No se toca el flujo actual. |
| Explorar | MangaDex: buscar, ficha, tapa. Vitrina. |
| Lector | El mismo. Local = archivos extraídos. Online = URLs de páginas del capítulo (si se implementa). |
| Descargar desde MangaDex | **No.** |

Uso personal ⇒ pocas peticiones, cache, sin prefetch masivo.

### Qué da la API

- Catálogo/ficha/tapa: sí, **sin login**.
- **Páginas del capítulo: sí**, pero no en la ficha. Flujo:
  1. id del chapter
  2. `GET /at-home/server/{chapterId}`
  3. armar URLs `baseUrl` + hash + nombres de archivo
- **No** mandar `Authorization` a `uploads.mangadex.org` ni `*.mangadex.network`.

### Credenciales

Para vitrina y páginas **no hacen falta**.

Sí hace falta:

- User-Agent identificable, ej. `TinMangas/1.0 (uso personal)`.
- Rate limits; backoff si 429.

Personal client (solo si más adelante hay follows / cuenta):

1. Cuenta en https://mangadex.org
2. https://mangadex.org/settings → **API client**
3. Pedir cliente personal; esperar aprobación
4. Client ID `personal-client-...` + secret (Get Secret)
5. Token: `POST https://auth.mangadex.org/realms/mangadex/protocol/openid-connect/token`  
   `grant_type=password` + usuario, password, client_id, client_secret
6. `access_token` ~15 min; `refresh_token` para renovar
7. Bearer **solo** a `api.mangadex.org` / `auth.mangadex.org`
8. No hardcodear secret en el APK; si se usa, Ajustes + JSON local

Docs: https://api.mangadex.org/docs/02-authentication/  
Personal clients: https://api.mangadex.org/docs/02-authentication/personal-clients/

### Arquitectura sugerida (cuando se implemente)

- Módulo nuevo `src/online/mangadex/` **separado** de `src/library/` y `src/archive/`.
- Tipos `RemoteSeries` / `RemoteChapter`; no reutilizar `Comic.uri` de archivo para ids de MangaDex.
- Progreso online: clave `md:{chapterId}` (o similar).
- Caché de búsqueda/ficha ~15–30 min; tapas en disco.
- UI: pestaña o pantalla **Explorar** además de Biblioteca.
- Idioma default español; rating seguro por defecto.
- Fases:
  1. Explorar: búsqueda + ficha + tapa
  2. (Opcional) Abrir capítulo en Reader con URLs, sin guardar CBR
  3. (Opcional) “¿Lo tengo en local?” por nombre, sin adivinar de más
  4. (No ahora) OAuth / follows

### Decisiones ya tomadas por el usuario

- API para **ver**, no para poblar la carpeta de descargas.
- Lo descargado entra por el lector CBR, otras fuentes.
- Pocas peticiones.
- Páginas de MangaDex existen y se pueden usar para leer online si se pide esa fase.

### Decisiones pendientes

- ¿Fase 1 solo vitrina, o también leer capítulo online?
- ¿Selector de idioma o fijo `es`?
- ¿Match suave con series locales en la ficha?

---

## Archivos clave

- `App.tsx` — fuentes, Gate, StatusBar según tema
- `src/theme.ts` — `colors` oscuro, `lightColors`, `paletteFor`
- `src/context/AppContext.tsx` — config, `colors`, progreso
- `src/screens/ReaderScreen.tsx` — RTL, slider, chrome
- `src/screens/LibraryScreen.tsx` — catálogo, header
- `src/archive/extract.ts` — openComic
- `modules/native-unrar/` — CBR en Android
- `src/storage/config.ts` — JSON
- `app.json` — nombre, versionCode, iconos

---

## Checklist al clonar en otra PC

1. Node + Android Studio (SDK + JBR 17/21).
2. `npm install`
3. Si no hay carpeta `android/`: prebuild y reaplicar nativo (unrar, largeHeap, strings, mipmaps).
4. `npx tsc --noEmit`
5. `assembleRelease` y sideload del APK
6. Pegar el prompt de arriba en Cursor y abrir `CONTINUAR.md`
