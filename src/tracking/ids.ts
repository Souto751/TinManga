import { isRemoteChapterUri } from '../online/mangadex/constants';
import { Comic, ComicProgress, TrackedTitle, TrackingStatus } from '../types';

export const TRACKING_LABELS: Record<TrackingStatus, string> = {
  plan: 'Por leer',
  reading: 'Leyendo',
  read: 'Leído',
};

export function localTrackingId(seriesId: string): string {
  return `local:${seriesId}`;
}

export function mangaTrackingId(mangaId: string): string {
  return `md:${mangaId}`;
}

export function trackingIdFromComic(comic: Comic): string | null {
  if (!comic.seriesId) {
    return null;
  }
  if (isRemoteChapterUri(comic.uri) || comic.id.startsWith('md:')) {
    return mangaTrackingId(comic.seriesId);
  }
  return localTrackingId(comic.seriesId);
}

export function trackingIdFromProgress(entry: ComicProgress): string | null {
  if (!entry.seriesId) {
    return null;
  }
  if (isRemoteChapterUri(entry.uri)) {
    return mangaTrackingId(entry.seriesId);
  }
  return localTrackingId(entry.seriesId);
}

export function seedTracking(progress: Record<string, ComicProgress>): Record<string, TrackedTitle> {
  const latest = new Map<string, ComicProgress>();
  for (const entry of Object.values(progress)) {
    const id = trackingIdFromProgress(entry);
    if (!id) {
      continue;
    }
    const previous = latest.get(id);
    if (!previous || entry.updatedAt > previous.updatedAt) {
      latest.set(id, entry);
    }
  }

  const tracking: Record<string, TrackedTitle> = {};
  for (const [id, entry] of latest) {
    const remote = isRemoteChapterUri(entry.uri);
    tracking[id] = {
      id,
      source: remote ? 'mangadex' : 'local',
      title: entry.series || entry.name,
      coverUri: entry.coverUri,
      status: 'reading',
      localSeriesId: remote ? undefined : entry.seriesId,
      mangaId: remote ? entry.seriesId : undefined,
      updatedAt: entry.updatedAt,
    };
  }
  return tracking;
}

export function trackedFromComic(
  comic: Comic,
  status: TrackingStatus,
  coverUri?: string,
): TrackedTitle | null {
  const id = trackingIdFromComic(comic);
  if (!id) {
    return null;
  }
  const remote = isRemoteChapterUri(comic.uri) || comic.id.startsWith('md:');
  return {
    id,
    source: remote ? 'mangadex' : 'local',
    title: comic.series || comic.displayName,
    coverUri: coverUri ?? comic.coverUri,
    status,
    localSeriesId: remote ? undefined : comic.seriesId,
    mangaId: remote ? comic.seriesId : undefined,
    updatedAt: Date.now(),
  };
}
