import { naturalCompare } from '../lib/hash';
import { Comic, Series } from '../types';

function volumeRank(comic: Comic): number {
  return comic.volume ?? Number.POSITIVE_INFINITY;
}

export function groupBySeries(comics: Comic[]): Series[] {
  const byId = new Map<string, Series>();

  for (const comic of comics) {
    const current = byId.get(comic.seriesId);
    if (current) {
      current.volumes.push(comic);
      continue;
    }
    byId.set(comic.seriesId, {
      id: comic.seriesId,
      name: comic.series,
      key: comic.seriesKey,
      volumes: [comic],
    });
  }

  return [...byId.values()]
    .map((series) => ({
      ...series,
      volumes: [...series.volumes].sort((a, b) => {
        const byVolume = volumeRank(a) - volumeRank(b);
        if (byVolume !== 0) {
          return byVolume;
        }
        return naturalCompare(a.filename, b.filename);
      }),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es', { numeric: true, sensitivity: 'base' }));
}
