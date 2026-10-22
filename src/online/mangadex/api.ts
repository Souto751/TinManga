import {
  MANGADEX_API,
  MANGADEX_COVERS,
  MANGADEX_USER_AGENT,
} from './constants';
import { RemoteChapter, RemoteManga } from './types';
import { ApiLanguage } from '../../types';

const TTL_MS = 20 * 60 * 1000;
const MIN_GAP_MS = 350;

// Idioma activo para pedirle a MangaDex tanto el filtro de capítulos/series
// como cuál título/descripción/tag mostrar. Lo actualiza AppContext cada vez
// que cambia config.apiLanguage (ver setApiLanguage más abajo); este módulo
// no tiene acceso directo al contexto de React.
let currentLanguage: ApiLanguage = 'es';

export function setApiLanguage(lang: ApiLanguage): void {
  currentLanguage = lang;
}

export function getApiLanguage(): ApiLanguage {
  return currentLanguage;
}

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
  return (
    map[currentLanguage] || map.es || map['es-la'] || map.en || map.ja || Object.values(map)[0] || ''
  );
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

// Cola real (no solo "mirar el reloj"): listChapters ahora dispara varios
// pedidos en paralelo (uno por contentRating) y, si dos llamadas a
// throttle() caen en el mismo tick de JS, las dos leen el mismo `lastCall`
// antes de que ninguna lo actualice y terminan saliendo casi juntas — el
// throttling deja de servir justo cuando más hace falta. Encadenando cada
// llamada detrás de la anterior nos aseguramos de que salgan una por una,
// separadas por MIN_GAP_MS, sin importar cuántas se disparen "a la vez".
let throttleChain: Promise<void> = Promise.resolve();

function throttle(): Promise<void> {
  const turn = throttleChain.then(async () => {
    const wait = MIN_GAP_MS - (Date.now() - lastCall);
    if (wait > 0) {
      await sleep(wait);
    }
    lastCall = Date.now();
  });
  // Si un turno anterior llegara a rechazar por algo raro, no queremos que
  // toda la cola quede trabada para siempre.
  throttleChain = turn.catch(() => undefined);
  return turn;
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
  let retries = 0;
  while (response.status === 429 && retries < 3) {
    retries += 1;
    await sleep(1600 * retries);
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
      contentRating?: string;
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
    contentRating: entry.attributes.contentRating,
  };
}

export async function searchManga(query: string): Promise<RemoteManga[]> {
  const trimmed = query.trim();
  const payload = await mdGet<MangaPayload>('/manga', {
    limit: '24',
    'includes[]': 'cover_art',
    'availableTranslatedLanguage[]': [currentLanguage],
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
      /** Si tiene valor, el capítulo no está alojado en MangaDex — es
       * solo un link a un lector oficial externo (MangaPlus/Viz, etc.).
       * No hay páginas que pedirle a /at-home/server para estos. */
      externalUrl?: string | null;
    };
  }>;
  total?: number;
};

const CONTENT_RATINGS = ['safe', 'suggestive', 'erotica', 'pornographic'];

async function fetchChapterFeed(mangaId: string, contentRating: string): Promise<RemoteChapter[]> {
  const collected: RemoteChapter[] = [];
  let offset = 0;
  const pageSize = 100;
  const maxOffset = 10000;

  while (offset < maxOffset) {
    const payload = await mdGet<FeedPayload>(`/manga/${mangaId}/feed`, {
      limit: String(pageSize),
      offset: String(offset),
      'translatedLanguage[]': [currentLanguage],
      'order[chapter]': 'asc',
      'order[volume]': 'asc',
      'contentRating[]': [contentRating],
    });
    collected.push(
      ...payload.data
        // Capítulos "externos" (link a MangaPlus/Viz/etc., típico en series
        // con licencia oficial simulpub como One Piece): MangaDex no aloja
        // sus páginas. Los dejamos en la lista igual (marcados con
        // externalUrl) para abrirlos en el navegador in-app en vez de en
        // nuestro lector — solo descartamos los que ni tienen páginas NI
        // un link a dónde mandar al usuario, esos sí son inservibles.
        .filter((entry) => entry.attributes.externalUrl || (entry.attributes.pages ?? 0) > 0)
        .map((entry) => ({
          id: entry.id,
          chapter: entry.attributes.chapter || '?',
          title: entry.attributes.title || '',
          volume: entry.attributes.volume || '',
          language: entry.attributes.translatedLanguage || '',
          pages: entry.attributes.pages ?? 0,
          publishAt: entry.attributes.publishAt,
          externalUrl: entry.attributes.externalUrl || undefined,
        })),
    );
    offset += pageSize;
    const total = payload.total ?? collected.length;
    if (!payload.data.length || collected.length >= total || offset >= total) {
      break;
    }
  }

  return collected;
}

export async function listChapters(
  mangaId: string,
  knownContentRating?: string,
): Promise<RemoteChapter[]> {
  // El endpoint /feed de MangaDex tiene un bug confirmado a mano contra la
  // API real: si "contentRating[]" lleva más de un valor DISTINTO en el
  // mismo pedido, devuelve total:0 aunque el manga sí tenga capítulos con
  // esos ratings (probado con One Piece y Chainsaw Man — un solo valor
  // trae los capítulos bien, dos o más siempre da vacío).
  //
  // Todos los capítulos de un manga comparten el contentRating del manga,
  // así que si ya lo sabemos (viene de getManga/searchManga) alcanza con
  // pedir ESE único valor — 1 sola tanda de pedidos, sin ráfaga y sin
  // pisar el bug. Si por algún motivo no lo tenemos a mano, probamos los 4
  // por separado y juntamos los resultados como respaldo.
  const ratings = knownContentRating ? [knownContentRating] : CONTENT_RATINGS;
  const perRating = await Promise.all(ratings.map((rating) => fetchChapterFeed(mangaId, rating)));
  const collected = perRating.flat();

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
