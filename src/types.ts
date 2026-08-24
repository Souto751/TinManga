export type ReadingDirection = 'rtl' | 'ltr';
export type ColorScheme = 'dark' | 'light';
export type TrackingStatus = 'plan' | 'reading' | 'read';

export type ComicProgress = {
  page: number;
  total: number;
  updatedAt: number;
  uri: string;
  name: string;
  series?: string;
  seriesId?: string;
  volumeLabel?: string;
  coverUri?: string;
  completed?: boolean;
};

export type TrackedTitle = {
  id: string;
  source: 'local' | 'mangadex';
  title: string;
  coverUri?: string;
  status: TrackingStatus;
  localSeriesId?: string;
  mangaId?: string;
  updatedAt: number;
};

export type AppConfig = {
  libraryUri: string | null;
  libraryName: string | null;
  coversFolderUri: string | null;
  coversFolderName: string | null;
  readingDirection: ReadingDirection;
  colorScheme: ColorScheme;
  keepScreenOn: boolean;
  progress: Record<string, ComicProgress>;
  seriesCovers: Record<string, string>;
  tracking: Record<string, TrackedTitle>;
};

export type Comic = {
  id: string;
  name: string;
  filename: string;
  uri: string;
  size: number;
  extension: string;
  series: string;
  seriesId: string;
  seriesKey: string;
  volume?: number;
  volumeLabel: string;
  displayName: string;
  coverUri?: string;
};

export type Series = {
  id: string;
  name: string;
  key: string;
  volumes: Comic[];
};

export type ExtractedComic = {
  id: string;
  pages: string[];
  coverUri?: string;
};
