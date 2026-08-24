import { Directory, File } from 'expo-file-system';
import JSZip from 'jszip';
import NativeUnrar from '../../modules/native-unrar';

import { fileExtension, isImageFilename, naturalCompare } from '../lib/hash';
import { Comic, ExtractedComic } from '../types';
import {
  archivesDir,
  coverPath,
  evictOldExtracts,
  extractDir,
  listExtractedPages,
  readExtractMeta,
  writeExtractMeta,
} from './cache';

export type ExtractProgress = (message: string, ratio: number) => void;

function toFsPath(uri: string): string {
  if (uri.startsWith('file://')) {
    return decodeURIComponent(uri.slice('file://'.length));
  }
  return uri;
}

async function yieldFrame(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

async function materializeArchive(comic: Comic): Promise<File> {
  const source = new File(comic.uri);
  const dest = new File(archivesDir(), `${comic.id}${comic.extension || '.cbr'}`);

  if (dest.exists && dest.size > 0 && comic.size > 0 && dest.size === comic.size) {
    return dest;
  }

  if (dest.exists) {
    dest.delete();
  }

  await source.copy(dest, { overwrite: true });
  return dest;
}

function writePage(dir: Directory, index: number, name: string, data: Uint8Array): string {
  const page = new File(dir, `${String(index).padStart(4, '0')}${fileExtension(name)}`);
  if (page.exists) {
    page.delete();
  }
  page.create();
  page.write(data);
  return page.uri;
}

function saveCover(id: string, firstPageUri: string): string | undefined {
  try {
    const source = new File(firstPageUri);
    const dest = coverPath(id);
    if (dest.exists) {
      dest.delete();
    }
    source.copySync(dest, { overwrite: true });
    return dest.uri;
  } catch {
    return firstPageUri;
  }
}

async function extractZipJs(bytes: Uint8Array, dir: Directory, onProgress?: ExtractProgress): Promise<string[]> {
  onProgress?.('Leyendo el archivo ZIP…', 0.15);
  const zip = await JSZip.loadAsync(bytes, { createFolders: true });
  const names = Object.keys(zip.files)
    .filter((name) => !zip.files[name].dir && isImageFilename(name))
    .sort(naturalCompare);

  if (names.length === 0) {
    throw new Error('El archivo no contiene páginas de imagen.');
  }

  const pages: string[] = [];
  for (let i = 0; i < names.length; i += 1) {
    const data = await zip.files[names[i]].async('uint8array');
    pages.push(writePage(dir, i, names[i], data));
    if (i % 4 === 0) {
      onProgress?.(`Preparando páginas… ${i + 1}/${names.length}`, 0.2 + (0.75 * (i + 1)) / names.length);
      await yieldFrame();
    }
  }
  return pages;
}

async function extractNative(archive: File, dir: Directory, onProgress?: ExtractProgress): Promise<string[]> {
  onProgress?.('Extrayendo páginas…', 0.2);
  const count = await NativeUnrar.extractImages(toFsPath(archive.uri), toFsPath(dir.uri));
  const pages = listExtractedPages(dir);
  if (pages.length === 0) {
    throw new Error(count > 0 ? 'Las páginas se extrajeron pero no se pudieron leer.' : 'El archivo no contiene páginas de imagen.');
  }
  onProgress?.('Listo', 0.95);
  return pages;
}

export async function openComic(comic: Comic, onProgress?: ExtractProgress): Promise<ExtractedComic> {
  const cachedMeta = readExtractMeta(comic.id);
  if (cachedMeta && (comic.size === 0 || cachedMeta.size === comic.size)) {
    const pages = listExtractedPages(extractDir(comic.id));
    if (pages.length > 0) {
      const cover = coverPath(comic.id);
      return {
        id: comic.id,
        pages,
        coverUri: cover.exists ? cover.uri : pages[0],
      };
    }
  }

  const dir = extractDir(comic.id);
  if (dir.exists) {
    dir.delete();
  }
  dir.create({ intermediates: true, overwrite: true });

  onProgress?.('Copiando el archivo…', 0.08);
  const archive = await materializeArchive(comic);
  onProgress?.('Abriendo el cómic…', 0.12);

  let pages: string[] = [];
  let lastError: unknown;

  try {
    pages = await extractNative(archive, dir, onProgress);
  } catch (nativeError) {
    lastError = nativeError;
    try {
      const bytes = await archive.bytes();
      pages = await extractZipJs(bytes, dir, onProgress);
    } catch (zipError) {
      const nativeMessage = lastError instanceof Error ? lastError.message : String(lastError);
      const zipMessage = zipError instanceof Error ? zipError.message : String(zipError);
      throw new Error(nativeMessage.includes('WebAssembly') ? zipMessage : nativeMessage);
    }
  }

  writeExtractMeta(comic.id, {
    sourceUri: comic.uri,
    size: comic.size,
    extractedAt: Date.now(),
    pageCount: pages.length,
  });

  const coverUri = saveCover(comic.id, pages[0]);
  await evictOldExtracts(comic.id);

  try {
    archive.delete();
  } catch {
    // cache copy can stay if deletion fails
  }

  onProgress?.('Listo', 1);
  return { id: comic.id, pages, coverUri };
}
