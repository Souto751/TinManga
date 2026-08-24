import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { coverPath } from '../archive/cache';
import {
  copySeriesCover,
  deleteSeriesCoverFile,
  matchFolderCover,
  pickImageFile,
  scanCoverFolder,
} from '../library/covers';
import { groupBySeries } from '../library/group';
import { pickLibraryFolder, scanLibrary } from '../library/scan';
import { loadConfig, saveConfig } from '../storage/config';
import { ColorTokens, paletteFor } from '../theme';
import { AppConfig, ColorScheme, Comic, ComicProgress, ReadingDirection, Series } from '../types';

type AppContextValue = {
  ready: boolean;
  config: AppConfig;
  colors: ColorTokens;
  comics: Comic[];
  series: Series[];
  scanning: boolean;
  error: string | null;
  pickFolder: () => Promise<void>;
  pickCoversFolder: () => Promise<void>;
  refreshLibrary: () => Promise<void>;
  setReadingDirection: (direction: ReadingDirection) => Promise<void>;
  setColorScheme: (scheme: ColorScheme) => Promise<void>;
  setKeepScreenOn: (value: boolean) => Promise<void>;
  saveProgress: (comic: Comic, page: number, total: number, coverUri?: string) => Promise<void>;
  resetProgress: (comicId: string) => Promise<void>;
  assignSeriesCover: (series: Series) => Promise<void>;
  clearSeriesCover: (seriesId: string) => Promise<void>;
  continueReading: ComicProgress | null;
  coverFor: (comicId: string, fallback?: string) => string | undefined;
  coverForSeries: (series: Series) => string | undefined;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [config, setConfig] = useState<AppConfig>({
    libraryUri: null,
    libraryName: null,
    coversFolderUri: null,
    coversFolderName: null,
    readingDirection: 'rtl',
    colorScheme: 'dark',
    keepScreenOn: true,
    progress: {},
    seriesCovers: {},
  });
  const [comics, setComics] = useState<Comic[]>([]);
  const [folderCovers, setFolderCovers] = useState<Record<string, string>>({});
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const configRef = useRef(config);
  configRef.current = config;

  const persist = useCallback(async (next: AppConfig) => {
    configRef.current = next;
    setConfig(next);
    await saveConfig(next);
  }, []);

  const refreshCovers = useCallback(async (uri?: string | null) => {
    const folderUri = uri === undefined ? configRef.current.coversFolderUri : uri;
    if (!folderUri) {
      setFolderCovers({});
      return;
    }
    try {
      setFolderCovers(await scanCoverFolder(folderUri));
    } catch {
      setFolderCovers({});
    }
  }, []);

  const refreshLibrary = useCallback(async (uri?: string) => {
    const libraryUri = uri ?? configRef.current.libraryUri;
    if (!libraryUri) {
      setComics([]);
      return;
    }
    setScanning(true);
    setError(null);
    try {
      const found = await scanLibrary(libraryUri);
      setComics(found);
      await refreshCovers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo leer la carpeta.');
      setComics([]);
    } finally {
      setScanning(false);
    }
  }, [refreshCovers]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const loaded = await loadConfig();
      if (cancelled) {
        return;
      }
      setConfig(loaded);
      configRef.current = loaded;
      setReady(true);
      if (loaded.coversFolderUri) {
        try {
          const covers = await scanCoverFolder(loaded.coversFolderUri);
          if (!cancelled) {
            setFolderCovers(covers);
          }
        } catch {
          if (!cancelled) {
            setFolderCovers({});
          }
        }
      }
      if (loaded.libraryUri) {
        setScanning(true);
        try {
          const found = await scanLibrary(loaded.libraryUri);
          if (!cancelled) {
            setComics(found);
          }
        } catch (err) {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : 'No se pudo leer la carpeta.');
          }
        } finally {
          if (!cancelled) {
            setScanning(false);
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const pickFolder = useCallback(async () => {
    const picked = await pickLibraryFolder();
    if (!picked) {
      return;
    }
    await persist({
      ...configRef.current,
      libraryUri: picked.uri,
      libraryName: picked.name,
    });
    await refreshLibrary(picked.uri);
  }, [persist, refreshLibrary]);

  const pickCoversFolder = useCallback(async () => {
    const picked = await pickLibraryFolder();
    if (!picked) {
      return;
    }
    await persist({
      ...configRef.current,
      coversFolderUri: picked.uri,
      coversFolderName: picked.name,
    });
    await refreshCovers(picked.uri);
  }, [persist, refreshCovers]);

  const setReadingDirection = useCallback(async (direction: ReadingDirection) => {
    await persist({ ...configRef.current, readingDirection: direction });
  }, [persist]);

  const setColorScheme = useCallback(async (scheme: ColorScheme) => {
    await persist({ ...configRef.current, colorScheme: scheme });
  }, [persist]);

  const setKeepScreenOn = useCallback(async (value: boolean) => {
    await persist({ ...configRef.current, keepScreenOn: value });
  }, [persist]);

  const saveProgress = useCallback(async (comic: Comic, page: number, total: number, coverUri?: string) => {
    const current = configRef.current;
    const previous = current.progress[comic.id];
    const nextProgress: ComicProgress = {
      page,
      total,
      updatedAt: Date.now(),
      uri: comic.uri,
      name: comic.displayName,
      series: comic.series,
      seriesId: comic.seriesId,
      volumeLabel: comic.volumeLabel,
      coverUri: coverUri ?? previous?.coverUri,
    };
    await persist({
      ...current,
      progress: {
        ...current.progress,
        [comic.id]: nextProgress,
      },
    });
  }, [persist]);

  const resetProgress = useCallback(async (comicId: string) => {
    const current = configRef.current;
    const progress = { ...current.progress };
    delete progress[comicId];
    await persist({ ...current, progress });
  }, [persist]);

  const assignSeriesCover = useCallback(async (series: Series) => {
    const picked = await pickImageFile();
    if (!picked) {
      return;
    }
    try {
      const uri = await copySeriesCover(series.id, picked.uri);
      const current = configRef.current;
      await persist({
        ...current,
        seriesCovers: {
          ...current.seriesCovers,
          [series.id]: uri,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo guardar la tapa.';
      throw new Error(message);
    }
  }, [persist]);

  const clearSeriesCover = useCallback(async (seriesId: string) => {
    const current = configRef.current;
    const previous = current.seriesCovers[seriesId];
    if (previous) {
      deleteSeriesCoverFile(previous);
    }
    const seriesCovers = { ...current.seriesCovers };
    delete seriesCovers[seriesId];
    await persist({ ...current, seriesCovers });
  }, [persist]);

  const series = useMemo(() => groupBySeries(comics), [comics]);

  const continueReading = useMemo(() => {
    const entries = Object.values(config.progress);
    if (entries.length === 0) {
      return null;
    }
    return entries.sort((a, b) => b.updatedAt - a.updatedAt)[0];
  }, [config.progress]);

  const coverFor = useCallback((comicId: string, fallback?: string) => {
    const fromProgress = config.progress[comicId]?.coverUri;
    if (fromProgress) {
      return fromProgress;
    }
    const file = coverPath(comicId);
    if (file.exists) {
      return file.uri;
    }
    return fallback;
  }, [config.progress]);

  const coverForSeries = useCallback((item: Series) => {
    const assigned = config.seriesCovers[item.id];
    if (assigned) {
      return assigned;
    }
    return matchFolderCover(item.key, folderCovers);
  }, [config.seriesCovers, folderCovers]);

  const colors = useMemo(() => paletteFor(config.colorScheme), [config.colorScheme]);

  const value = useMemo<AppContextValue>(
    () => ({
      ready,
      config,
      colors,
      comics,
      series,
      scanning,
      error,
      pickFolder,
      pickCoversFolder,
      refreshLibrary,
      setReadingDirection,
      setColorScheme,
      setKeepScreenOn,
      saveProgress,
      resetProgress,
      assignSeriesCover,
      clearSeriesCover,
      continueReading,
      coverFor,
      coverForSeries,
    }),
    [
      ready,
      config,
      colors,
      comics,
      series,
      scanning,
      error,
      pickFolder,
      pickCoversFolder,
      refreshLibrary,
      setReadingDirection,
      setColorScheme,
      setKeepScreenOn,
      saveProgress,
      resetProgress,
      assignSeriesCover,
      clearSeriesCover,
      continueReading,
      coverFor,
      coverForSeries,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) {
    throw new Error('useApp debe usarse dentro de AppProvider');
  }
  return value;
}
