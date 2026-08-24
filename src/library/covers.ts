import { Directory, File, Paths } from 'expo-file-system';
import { StorageAccessFramework } from 'expo-file-system/legacy';

import { isImageFilename } from '../lib/hash';
import { normalizeSeriesKey } from '../lib/parse';

export function seriesCoversDir(): Directory {
  const dir = new Directory(Paths.document, 'series-covers');
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }
  return dir;
}

function decodeEntryName(uri: string): string {
  const raw = uri.split('/').pop() ?? uri;
  try {
    return decodeURIComponent(raw.replace(/\+/g, ' '));
  } catch {
    return raw;
  }
}

function imageKeys(filename: string): string[] {
  const base = filename.replace(/\.[a-z0-9]+$/i, '');
  const spaced = normalizeSeriesKey(base);
  const compact = spaced.replace(/\s+/g, '');
  return Array.from(new Set([spaced, compact].filter(Boolean)));
}

async function listImageEntries(folderUri: string): Promise<{ name: string; uri: string }[]> {
  const dir = new Directory(folderUri);
  try {
    if (dir.exists) {
      const records = dir.listAsRecords();
      return records
        .filter((record) => !record.isDirectory && isImageFilename(decodeEntryName(record.uri)))
        .map((record) => ({
          name: decodeEntryName(record.uri),
          uri: record.uri,
        }));
    }
  } catch {
    try {
      return dir
        .list()
        .filter((item): item is File => item instanceof File && isImageFilename(item.name))
        .map((file) => ({ name: file.name, uri: file.uri }));
    } catch {
      // SAF fallback
    }
  }

  try {
    const uris = await StorageAccessFramework.readDirectoryAsync(folderUri);
    return uris
      .map((uri) => ({ name: decodeEntryName(uri), uri }))
      .filter((entry) => isImageFilename(entry.name));
  } catch {
    return [];
  }
}

export async function scanCoverFolder(folderUri: string): Promise<Record<string, string>> {
  const images = await listImageEntries(folderUri);
  const map: Record<string, string> = {};

  for (const image of images) {
    for (const key of imageKeys(image.name)) {
      if (!map[key]) {
        map[key] = image.uri;
      }
    }
  }

  return map;
}

export function matchFolderCover(seriesKey: string, folderCovers: Record<string, string>): string | undefined {
  return folderCovers[seriesKey] ?? folderCovers[seriesKey.replace(/\s+/g, '')];
}

export async function copySeriesCover(seriesId: string, sourceUri: string): Promise<string> {
  const source = new File(sourceUri);
  const extension = source.extension || '.jpg';
  const dest = new File(seriesCoversDir(), `${seriesId}${extension.startsWith('.') ? extension : `.${extension}`}`);
  if (dest.exists) {
    dest.delete();
  }
  await source.copy(dest, { overwrite: true });
  return dest.uri;
}

export function deleteSeriesCoverFile(uri: string): void {
  try {
    const file = new File(uri);
    if (file.exists) {
      file.delete();
    }
  } catch {
    // ignore
  }
}

export async function pickImageFile(): Promise<File | null> {
  try {
    const result = await File.pickFileAsync({ mimeTypes: ['image/*'] });
    if (result.canceled || !result.result) {
      return null;
    }
    return result.result;
  } catch {
    return null;
  }
}
