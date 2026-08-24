import { Comic } from '../../types';
import { CHAPTER_PREFIX } from './constants';
import { RemoteChapter, RemoteManga } from './types';

export function comicFromRemoteChapter(manga: RemoteManga, chapter: RemoteChapter): Comic {
  const volumeLabel = chapter.chapter === '?'
    ? 'Oneshot'
    : `Cap. ${chapter.chapter}`;
  const extra = chapter.title ? ` · ${chapter.title}` : '';

  return {
    id: `md:${chapter.id}`,
    name: `${manga.title} ${volumeLabel}`,
    filename: `${manga.title} ${volumeLabel}`,
    uri: `${CHAPTER_PREFIX}${chapter.id}`,
    size: 0,
    extension: '',
    series: manga.title,
    seriesId: manga.id,
    seriesKey: manga.id,
    volumeLabel: `${volumeLabel}${extra}`,
    displayName: `${manga.title} ${volumeLabel}${extra}`,
    coverUri: manga.coverUri,
  };
}
