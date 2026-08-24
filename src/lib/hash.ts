export function makeId(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

export function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

export function titleFromFilename(filename: string): string {
  return filename.replace(/\.(cbz|cbr|zip|rar)$/i, '').replace(/[_]+/g, ' ').trim();
}

export function isComicFilename(name: string): boolean {
  return /\.(cbz|cbr|zip|rar)$/i.test(name);
}

export function isImageFilename(name: string): boolean {
  const normalized = name.replace(/\\/g, '/');
  if (normalized.includes('__MACOSX') || normalized.endsWith('.DS_Store')) {
    return false;
  }
  return /\.(jpe?g|png|webp|gif|bmp)$/i.test(normalized);
}

export function fileExtension(name: string): string {
  const match = name.match(/(\.[a-z0-9]+)$/i);
  return match ? match[1].toLowerCase() : '.jpg';
}
