# TinMangas

Lector de mangas, cómics y webtoons para Android. Lee archivos `.cbr`, `.cbz`, `.rar` y `.zip` de una carpeta del teléfono, y también puede explorar y leer capítulos de [MangaDex](https://mangadex.org). No usa servidor ni cuenta: el progreso se guarda en un JSON dentro de la app.

> **App personal.** La hice para mi propio uso: no está en Play Store, no tiene soporte y no acepto pedidos de funciones. El código es público para quien quiera ver cómo está hecha, y el APK está en Releases para quien quiera probarla, sin garantías.

## Descargar

Bajá el `.apk` del [último release](https://github.com/Souto751/TinManga/releases/latest) y abrilo en el teléfono (Android te va a pedir permiso para instalar apps de orígenes desconocidos). Las versiones siguientes se avisan y se instalan desde la misma app.

## Funciones

- **Biblioteca local**: elegís una carpeta y agrupa los archivos por serie y tomo, con tapas automáticas o elegidas a mano.
- **Tres modos de lectura**: manga (derecha a izquierda), cómic (izquierda a derecha) y webtoon (vertical continuo). Cada serie recuerda su modo.
- **Zoom** con pellizco o doble toque, también sobre la tira en modo webtoon.
- **Al terminar un tomo o capítulo** pasa solo al siguiente.
- **MangaDex**: búsqueda, ficha de cada serie y lectura online de capítulos, con modo sin conexión.
- **Listas** de seguimiento (pendiente, leyendo, leído).
- **Auto-actualización** desde los releases de GitHub.
- Tema oscuro y claro.

## Cómo está hecha

| Parte | Detalle |
| --- | --- |
| App | Expo SDK 57, React Native 0.86 (New Architecture, Hermes), TypeScript |
| RAR / CBR | Módulo nativo propio en Kotlin (`modules/native-unrar`) |
| Lector | `FlatList` paginada o vertical, `expo-image`, gestos con Reanimated + Gesture Handler |
| Datos | JSON local (`lectorcbr.json`) y caché de páginas extraídas; sin base de datos ni backend |
| Releases | GitHub Actions compila el APK firmado al pushear un tag `vX.Y.Z` y lo publica con un `latest.json` que la app consulta |

## Lectura

- Tocá un tercio del lado de avance para pasar página, el centro para mostrar controles, o deslizá.
- En modo webtoon, tocá arriba o abajo para avanzar o retroceder casi una pantalla. Con zoom puesto podés seguir deslizando.
- El modo se cambia con el botón del lector (se guarda por serie) o en **Ajustes** (el que usan las series nuevas).
- Al reabrir un título vuelve a la última página. Mantené presionado un tomo para reiniciar el progreso.

## Tapas de series

Los archivos tipo `Pandora Hearts - Tomo 01 (#001-004).cbr` se agrupan como **Pandora Hearts**, tomo 1.

Hay dos formas de ponerle tapa a una serie:

1. En **Ajustes → Carpeta de tapas**, elegí una carpeta (por ejemplo `img` en el teléfono) con imágenes llamadas como la serie: `Pandora Hearts.jpg`.
2. Mantené presionada la serie en el catálogo, o tocá **Tapa** dentro de la serie, y elegí una imagen a mano.

## Archivo de configuración

El progreso y la carpeta elegida viven en `lectorcbr.json` dentro del almacenamiento de la app. No hay cuenta, ni nube, ni nada hosteado.

La primera apertura de un archivo extrae las páginas a caché local. Las siguientes veces es inmediata.

## Compilar

Necesita Node.js, Android Studio (SDK + JDK) y el módulo nativo, así que **no funciona con Expo Go**.

```bash
npm install
npx expo prebuild -p android --clean
cd android
./gradlew assembleRelease
```

Firma, publicación de versiones y build de prueba (que se instala al lado de la app sin pisarla): ver [RELEASES.md](RELEASES.md).

## Notas

- Los `.cbr` reales (RAR) tardan más en abrirse la primera vez; las siguientes son inmediatas porque las páginas quedan en caché.
- TinMangas no está afiliada a MangaDex. Usa su API pública con pocas peticiones y caché, respetando sus [condiciones](https://api.mangadex.org/docs/).

## Licencia

[MIT](LICENSE)
