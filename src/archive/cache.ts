import { Directory, File, Paths } from 'expo-file-system';

const MAX_CACHED_COMICS = 4;

function pagesRoot(): Directory {
  const dir = new Directory(Paths.cache, 'pages');
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }
  return dir;
}

export function coversDir(): Directory {
  const dir = new Directory(Paths.cache, 'covers');
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }
  return dir;
}

export function extractDir(id: string): Directory {
  return new Directory(pagesRoot(), id);
}

export type ExtractMeta = {
  sourceUri: string;
  size: number;
  extractedAt: number;
  pageCount: number;
};

export function readExtractMeta(id: string): ExtractMeta | null {
  const file = new File(extractDir(id), 'meta.json');
  if (!file.exists) {
    return null;
  }
  try {
    return JSON.parse(file.textSync()) as ExtractMeta;
  } catch {
    return null;
  }
}

export function writeExtractMeta(id: string, meta: ExtractMeta): void {
  const file = new File(extractDir(id), 'meta.json');
  if (!file.exists) {
    file.create({ overwrite: true });
  }
  file.write(JSON.stringify(meta, null, 2));
}

function collectImageFiles(dir: Directory): File[] {
  const files: File[] = [];
  for (const item of dir.list()) {
    if (item instanceof Directory) {
      files.push(...collectImageFiles(item));
      continue;
    }
    if (item instanceof File && /\.(jpe?g|png|webp|gif|bmp)$/i.test(item.name) && !item.name.includes('__MACOSX')) {
      files.push(item);
    }
  }
  return files;
}

export function listExtractedPages(target: string | Directory): string[] {
  const dir = typeof target === 'string' ? extractDir(target) : target;
  if (!dir.exists) {
    return [];
  }

  return collectImageFiles(dir)
    .sort((a, b) => a.uri.localeCompare(b.uri, undefined, { numeric: true }))
    .map((file) => file.uri);
}

export function coverPath(id: string): File {
  return new File(coversDir(), `${id}.jpg`);
}

export async function evictOldExtracts(keepId: string): Promise<void> {
  const root = pagesRoot();
  const dirs = root.list().filter((item): item is Directory => item instanceof Directory);
  if (dirs.length <= MAX_CACHED_COMICS) {
    return;
  }

  const ranked = dirs
    .map((dir) => ({
      dir,
      extractedAt: readExtractMeta(dir.name)?.extractedAt ?? 0,
    }))
    .sort((a, b) => a.extractedAt - b.extractedAt);

  while (ranked.length > MAX_CACHED_COMICS) {
    const oldest = ranked.shift();
    if (!oldest || oldest.dir.name === keepId) {
      continue;
    }
    try {
      oldest.dir.delete();
    } catch {
      // ignore
    }
  }
}

export async function clearPageCache(): Promise<void> {
  const root = pagesRoot();
  if (root.exists) {
    root.delete();
  }
  pagesRoot();
}

export function archivesDir(): Directory {
  const dir = new Directory(Paths.cache, 'archives');
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }
  return dir;
}
