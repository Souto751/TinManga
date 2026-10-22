/** rtl = manga, ltr = cómic, vertical = webtoon (páginas una debajo de la otra). */
export type ReadingDirection = 'rtl' | 'ltr' | 'vertical';
export type ColorScheme = 'dark' | 'light';
export type TrackingStatus = 'plan' | 'reading' | 'read';
export type ApiLanguage = 'es' | 'es-la' | 'en';

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
  /** Modo por defecto para series que todavía no tienen uno propio. */
  readingDirection: ReadingDirection;
  /** Modo elegido para cada serie (clave: seriesDirectionKey), así un webtoon y un manga no se pisan. */
  seriesDirections: Record<string, ReadingDirection>;
  colorScheme: ColorScheme;
  keepScreenOn: boolean;
  /** Si está en false, Explorar (MangaDex) queda inhabilitado — solo biblioteca local. */
  onlineMode: boolean;
  /** Idioma con el que se buscan/muestran los resultados de MangaDex. */
  apiLanguage: ApiLanguage;
  progress: Record<string, ComicProgress>;
  seriesCovers: Record<string, string>;
  tracking: Record<string, TrackedTitle>;
  /** versionCode de una actualización que el usuario cerró a mano (no se vuelve a avisar sola). */
  updateDismissedVersionCode: number | null;
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
