import { Directory, File } from 'expo-file-system';
import { Platform } from 'react-native';
import { StorageAccessFramework } from 'expo-file-system/legacy';

import { isComicFilename, makeId } from '../lib/hash';
import { parseComicFilename } from '../lib/parse';
import { Comic } from '../types';

const MAX_DEPTH = 3;

function decodeEntryName(uri: string): string {
  const raw = uri.split('/').pop() ?? uri;
  try {
    return decodeURIComponent(raw.replace(/\+/g, ' '));
  } catch {
    return raw;
  }
}

export function friendlyFolderName(uri: string, fallback: string): string {
  const decoded = decodeEntryName(uri);
  const colon = decoded.lastIndexOf(':');
  const path = colon >= 0 ? decoded.slice(colon + 1) : decoded;
  const segments = path.split(/[/\\]/).filter(Boolean);
  return segments[segments.length - 1] || fallback;
}

export async function pickLibraryFolder(): Promise<{ uri: string; name: string } | null> {
  if (Platform.OS === 'android') {
    const permission = await StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (!permission.granted) {
      return null;
    }
    return {
      uri: permission.directoryUri,
      name: friendlyFolderName(permission.directoryUri, 'Biblioteca'),
    };
  }

  const directory = await Directory.pickDirectoryAsync();
  return {
    uri: directory.uri,
    name: directory.name || 'Biblioteca',
  };
}

function asDirectory(uri: string): Directory {
  return new Directory(uri);
}

function collectFromList(dir: Directory, depth: number, series?: string): Comic[] {
  const comics: Comic[] = [];
  let records: { isDirectory: boolean; uri: string }[] = [];

  try {
    records = dir.listAsRecords();
  } catch {
    try {
      records = dir.list().map((item) => ({
        isDirectory: typeof (item as Directory).list === 'function' && !isComicFilename(item.name),
        uri: item.uri,
      }));
    } catch {
      return comics;
    }
  }

  for (const record of records) {
    if (record.isDirectory) {
      if (depth < MAX_DEPTH) {
        const nested = new Directory(record.uri);
        const nestedSeries = series ?? nested.name;
        comics.push(...collectFromList(nested, depth + 1, nestedSeries));
      }
      continue;
    }

    const file = new File(record.uri);
    if (!isComicFilename(file.name)) {
      continue;
    }

    const parsed = parseComicFilename(file.name, series);
    comics.push({
      id: makeId(file.uri),
      name: parsed.displayName,
      filename: file.name,
      uri: file.uri,
      size: file.size ?? 0,
      extension: file.extension || '',
      series: parsed.series,
      seriesId: parsed.seriesId,
      seriesKey: parsed.seriesKey,
      volume: parsed.volume,
      volumeLabel: parsed.volumeLabel,
      displayName: parsed.displayName,
    });
  }

  return comics;
}

async function collectFromSaf(dirUri: string, depth: number, series?: string): Promise<Comic[]> {
  const comics: Comic[] = [];
  let uris: string[] = [];

  try {
    uris = await StorageAccessFramework.readDirectoryAsync(dirUri);
  } catch {
    return comics;
  }

  for (const childUri of uris) {
    const name = decodeEntryName(childUri);

    if (isComicFilename(name)) {
      const file = new File(childUri);
      const parsed = parseComicFilename(name, series);
      comics.push({
        id: makeId(childUri),
        name: parsed.displayName,
        filename: name,
        uri: childUri,
        size: file.size ?? 0,
        extension: file.extension || '',
        series: parsed.series,
        seriesId: parsed.seriesId,
        seriesKey: parsed.seriesKey,
        volume: parsed.volume,
        volumeLabel: parsed.volumeLabel,
        displayName: parsed.displayName,
      });
      continue;
    }

    const looksLikeLooseFile = /\.[a-z0-9]{1,5}$/i.test(name);
    if (!looksLikeLooseFile && depth < MAX_DEPTH) {
      const nested = await collectFromSaf(childUri, depth + 1, series ?? name);
      if (nested.length > 0) {
        comics.push(...nested);
      }
    }
  }

  return comics;
}

export async function scanLibrary(libraryUri: string): Promise<Comic[]> {
  const root = asDirectory(libraryUri);

  try {
    if (root.exists) {
      const fromApi = collectFromList(root, 0);
      if (fromApi.length > 0) {
        return fromApi.sort((a, b) => a.name.localeCompare(b.name, 'es', { numeric: true }));
      }
    }
  } catch {
    // SAF fallback below
  }

  const fromSaf = await collectFromSaf(libraryUri, 0);
  return fromSaf.sort((a, b) => a.name.localeCompare(b.name, 'es', { numeric: true }));
}
