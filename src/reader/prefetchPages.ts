import { Image } from 'expo-image';

import { MANGADEX_USER_AGENT } from '../online/mangadex/constants';

const done = new Set<string>();
const inflight = new Set<string>();

export function resetPagePrefetch(): void {
  done.clear();
  inflight.clear();
}

export function pagesAround(pages: string[], index: number, behind: number, ahead: number): string[] {
  const start = Math.max(0, index - behind);
  const end = Math.min(pages.length, index + 1 + ahead);
  return pages.slice(start, end);
}

export async function prefetchPageUrls(urls: string[], remote: boolean): Promise<void> {
  const headers = remote ? { 'User-Agent': MANGADEX_USER_AGENT } : undefined;
  const pending = urls.filter((url) => url && !done.has(url) && !inflight.has(url));
  await Promise.all(
    pending.map(async (url) => {
      inflight.add(url);
      try {
        const ok = await Image.prefetch(url, {
          cachePolicy: 'memory-disk',
          headers,
        });
        if (ok) {
          done.add(url);
        }
      } catch {
        // Si una falla, la próxima ventana la reintenta.
      } finally {
        inflight.delete(url);
      }
    }),
  );
}

export function waitWithTimeout(task: Promise<void>, ms: number): Promise<void> {
  return Promise.race([
    task,
    new Promise<void>((resolve) => {
      setTimeout(resolve, ms);
    }),
  ]);
}
