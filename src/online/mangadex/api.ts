import {
  MANGADEX_API,
  MANGADEX_COVERS,
  MANGADEX_USER_AGENT,
} from './constants';
import { RemoteChapter, RemoteManga } from './types';

const TTL_MS = 20 * 60 * 1000;
const MIN_GAP_MS = 350;
const LANGS = ['es', 'es-la'];

type CacheEntry = { at: number; value: unknown };

const cache = new Map<string, CacheEntry>();
let lastCall = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pickLocale(map?: Record<string, string> | null): string {
  if (!map) {
    return '';
  }
  return map.es || map['es-la'] || map.en || map.ja || Object.values(map)[0] || '';
}

function coverUrl(mangaId: string, fileName?: string): string | undefined {
  if (!fileName) {
    return undefined;
  }
  return `${MANGADEX_COVERS}/${mangaId}/${fileName}.256.jpg`;
}

function coverFromManga(data: {
  id: string;
  relationships?: Array<{ type: string; attributes?: { fileName?: string } }>;
}): string | undefined {
  const art = data.relationships?.find((item) => item.type === 'cover_art');
  return coverUrl(data.id, art?.attributes?.fileName);
}

async function throttle(): Promise<void> {
  const wait = MIN_GAP_MS - (Date.now() - lastCall);
  if (wait > 0) {
    await sleep(wait);
  }
  lastCall = Date.now();
}

async function mdGet<T>(
  path: string,
  params?: Record<string, string | string[]>,
  options?: { cache?: boolean },
): Promise<T> {
  const url = new URL(path, `${MANGADEX_API}/`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      const list = Array.isArray(value) ? value : [value];
      for (const item of list) {
        url.searchParams.append(key, item);
      }
    }
  }

  const useCache = options?.cache !== false;
  const cacheKey = url.toString();
  if (useCache) {
    const hit = cache.get(cacheKey);
    if (hit && Date.now() - hit.at < TTL_MS) {
      return hit.value as T;
    }
  }

  await throttle();

  const request = async (): Promise<Response> =>
    fetch(url.toString(), {
      headers: {
        Accept: 'application/json',
        'User-Agent': MANGADEX_USER_AGENT,
      },
    });

  let response = await request();
  if (response.status === 429) {
    await sleep(1600);
    response = await request();
  }
  if (!response.ok) {
    throw new Error(`MangaDex ${response.status}: no se pudo completar el pedido.`);
  }

  const json = (await response.json()) as T & { result?: string; errors?: Array<{ detail?: string }> };
  if (json && typeof json === 'object' && json.result === 'error') {
    throw new Error(json.errors?.[0]?.detail || 'MangaDex rechazó el pedido.');
  }
  if (useCache) {
    cache.set(cacheKey, { at: Date.now(), value: json });
  }
  return json;
}

type MangaPayload = {
  data: Array<{
    id: string;
    attributes: {
      title?: Record<string, string>;
      description?: Record<string, string>;
      status?: string;
      year?: number | null;
      tags?: Array<{ attributes?: { name?: Record<string, string> } }>;
    };
    relationships?: Array<{ type: string; attributes?: { fileName?: string } }>;
  }>;
};

function mapManga(entry: MangaPayload['data'][number]): RemoteManga {
  return {
    id: entry.id,
    title: pickLocale(entry.attributes.title) || 'Sin título',
    description: pickLocale(entry.attributes.description),
    status: entry.attributes.status || '',
    year: entry.attributes.year ?? undefined,
    tags: (entry.attributes.tags ?? [])
      .map((tag) => pickLocale(tag.attributes?.name))
      .filter(Boolean)
      .slice(0, 8),
    coverUri: coverFromManga(entry),
  };
}

export async function searchManga(query: string): Promise<RemoteManga[]> {
  const trimmed = query.trim();
  const payload = await mdGet<MangaPayload>('/manga', {
    limit: '24',
    'includes[]': 'cover_art',
    'availableTranslatedLanguage[]': LANGS,
    'contentRating[]': ['safe', 'suggestive'],
    ...(trimmed
      ? { title: trimmed, 'order[relevance]': 'desc' }
      : { 'order[followedCount]': 'desc' }),
  });
  return payload.data.map(mapManga);
}

type MangaOne = {
  data: MangaPayload['data'][number];
};

export async function getManga(id: string): Promise<RemoteManga> {
  const payload = await mdGet<MangaOne>(`/manga/${id}`, {
    'includes[]': 'cover_art',
  });
  return mapManga(payload.data);
}

type FeedPayload = {
  data: Array<{
    id: string;
    attributes: {
      chapter?: string | null;
      title?: string | null;
      volume?: string | null;
      translatedLanguage?: string;
      pages?: number;
      publishAt?: string;
    };
  }>;
  total?: number;
};

export async function listChapters(mangaId: string): Promise<RemoteChapter[]> {
  const collected: RemoteChapter[] = [];
  let offset = 0;
  const pageSize = 100;
  const maxOffset = 10000;

  while (offset < maxOffset) {
    const payload = await mdGet<FeedPayload>(`/manga/${mangaId}/feed`, {
      limit: String(pageSize),
      offset: String(offset),
      'translatedLanguage[]': LANGS,
      'order[chapter]': 'asc',
      'order[volume]': 'asc',
      'contentRating[]': ['safe', 'suggestive', 'erotica', 'pornographic'],
    });
    collected.push(
      ...payload.data.map((entry) => ({
        id: entry.id,
        chapter: entry.attributes.chapter || '?',
        title: entry.attributes.title || '',
        volume: entry.attributes.volume || '',
        language: entry.attributes.translatedLanguage || '',
        pages: entry.attributes.pages ?? 0,
        publishAt: entry.attributes.publishAt,
      })),
    );
    offset += pageSize;
    const total = payload.total ?? collected.length;
    if (!payload.data.length || collected.length >= total || offset >= total) {
      break;
    }
  }

  const best = new Map<string, RemoteChapter>();
  for (const chapter of collected) {
    const key = `${chapter.chapter}-${chapter.language}`;
    const previous = best.get(key);
    if (!previous || chapter.pages > previous.pages) {
      best.set(key, chapter);
    }
  }
  return [...best.values()].sort((a, b) => chapterSortValue(a) - chapterSortValue(b));
}

export function chapterSortValue(chapter: RemoteChapter): number {
  const parsed = Number.parseFloat(chapter.chapter.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

type AtHomePayload = {
  baseUrl: string;
  chapter: {
    hash: string;
    data: string[];
    dataSaver: string[];
  };
};

export async function getChapterPages(chapterId: string): Promise<string[]> {
  const payload = await mdGet<AtHomePayload>(
    `/at-home/server/${chapterId}`,
    { forcePort443: 'true' },
    { cache: false },
  );
  const files = payload.chapter.dataSaver?.length
    ? payload.chapter.dataSaver
    : payload.chapter.data;
  const quality = payload.chapter.dataSaver?.length ? 'data-saver' : 'data';
  return files.map(
    (file) => `${payload.baseUrl}/${quality}/${payload.chapter.hash}/${file}`,
  );
}
