# TinMangas

Lector local de mangas y cómics en `.cbr`, `.cbz`, `.rar` y `.zip`. No usa base de datos ni servidor: elegís una carpeta, ves el catálogo y el progreso se guarda en un JSON dentro de la app.

## Cómo usarla

1. Instalá [Node.js](https://nodejs.org/) y, en el teléfono, **Expo Go**.
2. En esta carpeta:

```bash
npm install
npm start
```

3. Escaneá el QR con Expo Go (Android) o la cámara (iPhone).
4. Elegí la carpeta donde están los mangas. El catálogo agrupa por serie y muestra los tomos.

## Lectura

- Por defecto está en modo **manga** (derecha a izquierda).
- Tocá un tercio del lado de avance para pasar página, el centro para mostrar controles, o deslizá.
- Al reabrir un título vuelve a la última página.
- Mantené presionado un tomo para reiniciar el progreso.

## Tapas de series

Los archivos tipo `Pandora Hearts - Tomo 01 (#001-004).cbr` se agrupan como **Pandora Hearts**, tomo 1.

Hay dos formas de ponerle tapa a una serie:

1. En **Ajustes → Carpeta de tapas**, elegí una carpeta (por ejemplo `img` en el teléfono) con imágenes llamadas como la serie: `Pandora Hearts.jpg`.
2. Mantené presionada la serie en el catálogo, o tocá **Tapa** dentro de la serie, y elegí una imagen a mano.

## Archivo de configuración

El progreso y la carpeta elegida viven en `lectorcbr.json` dentro del almacenamiento de la app. No hay cuenta, ni nube, ni nada hosteado.

La primera apertura de un archivo extrae las páginas a caché local. Las siguientes veces es inmediata.

## Notas

- En **Android** la carpeta queda recordada.
- En **iOS** el acceso a la carpeta puede pedirse de nuevo al reiniciar la app.
- Los `.cbr` reales (RAR) pesan más al abrirlos; si un archivo falla, conviene tenerlo también en `.cbz`.
