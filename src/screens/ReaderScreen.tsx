import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import Slider from '@react-native-community/slider';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { openComic } from '../archive/extract';
import { useApp } from '../context/AppContext';
import { RootStackParamList } from '../navigation/types';
import { getChapterPages } from '../online/mangadex/api';
import { isRemoteChapterUri, remoteChapterId } from '../online/mangadex/constants';
import { ReaderPage } from '../reader/ReaderPage';
import { pagesAround, prefetchPageUrls, resetPagePrefetch, waitWithTimeout } from '../reader/prefetchPages';
import { ColorTokens, fonts } from '../theme';

export function ReaderScreen() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const navigation = useNavigation();
  const { comic } = useRoute<RouteProp<RootStackParamList, 'Reader'>>().params;
  const { config, colors, saveProgress, setReadingDirection } = useApp();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const listRef = useRef<FlatList<string>>(null);
  const pageRef = useRef(0);
  const savedPage = useRef(config.progress[comic.id]?.page ?? 0);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rtlRef = useRef(config.readingDirection === 'rtl');

  const [pages, setPages] = useState<string[]>([]);
  const [page, setPage] = useState(savedPage.current);
  const [uiVisible, setUiVisible] = useState(true);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('Abriendo…');
  const [ratio, setRatio] = useState(0.05);
  const [error, setError] = useState<string | null>(null);

  const rtl = config.readingDirection === 'rtl';
  rtlRef.current = rtl;
  const remote = isRemoteChapterUri(comic.uri);

  const openRemoteChapter = async () => {
    const chapterId = remoteChapterId(comic.uri);
    if (!chapterId) {
      throw new Error('Capítulo remoto inválido.');
    }
    setStatus('Pidiendo páginas a MangaDex…');
    setRatio(0.35);
    const pages = await getChapterPages(chapterId);
    if (pages.length === 0) {
      throw new Error('Este capítulo no tiene páginas públicas.');
    }
    setStatus('Listo');
    setRatio(1);
    return { pages, coverUri: comic.coverUri };
  };

  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  useEffect(() => {
    if (!config.keepScreenOn) {
      return undefined;
    }
    void activateKeepAwakeAsync('lector-cbr');
    return () => {
      void deactivateKeepAwake('lector-cbr');
    };
  }, [config.keepScreenOn]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        resetPagePrefetch();
        const extracted = isRemoteChapterUri(comic.uri)
          ? await openRemoteChapter()
          : await openComic(comic, (message, nextRatio) => {
              if (!cancelled) {
                setStatus(message);
                setRatio(nextRatio);
              }
            });
        if (cancelled) {
          return;
        }
        const initial = Math.min(savedPage.current, Math.max(extracted.pages.length - 1, 0));
        if (!cancelled) {
          setStatus('Precargando páginas…');
          setRatio(0.78);
        }
        await waitWithTimeout(
          prefetchPageUrls(pagesAround(extracted.pages, initial, 0, 2), isRemoteChapterUri(comic.uri)),
          2500,
        );
        if (cancelled) {
          return;
        }
        setPages(extracted.pages);
        setPage(initial);
        pageRef.current = initial;
        await saveProgress(comic, initial, extracted.pages.length, extracted.coverUri ?? comic.coverUri);
        setLoading(false);
        setTimeout(() => {
          if (!cancelled) {
            setUiVisible(false);
          }
        }, 1400);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'No se pudo abrir el archivo.');
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // Extraemos una sola vez al abrir este archivo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comic.id, comic.uri]);

  const persistPage = useCallback(
    (nextPage: number) => {
      if (pages.length === 0) {
        return;
      }
      void saveProgress(comic, nextPage, pages.length);
    },
    [comic, pages.length, saveProgress],
  );

  const persistPageRef = useRef(persistPage);
  persistPageRef.current = persistPage;

  useEffect(() => {
    if (loading || pages.length === 0) {
      return;
    }
    void prefetchPageUrls(pagesAround(pages, page, 1, 5), remote);
  }, [loading, pages, page, remote]);

  const goTo = useCallback(
    (next: number, haptic = true) => {
      if (pages.length === 0) {
        return;
      }
      const clamped = Math.max(0, Math.min(pages.length - 1, next));
      if (clamped === pageRef.current) {
        return;
      }
      pageRef.current = clamped;
      setPage(clamped);
      listRef.current?.scrollToIndex({ index: clamped, animated: true });
      persistPage(clamped);
      if (haptic) {
        void Haptics.selectionAsync();
      }
    },
    [pages.length, persistPage],
  );

  const toggleDirection = () => {
    void setReadingDirection(rtl ? 'ltr' : 'rtl');
    void Haptics.selectionAsync();
    setUiVisible(true);
  };

  const handleTap = useCallback(
    (x: number) => {
      const zone = x / width;
      if (zone > 0.33 && zone < 0.67) {
        setUiVisible((visible) => !visible);
        return;
      }
      const nextSide = rtlRef.current ? zone < 0.33 : zone > 0.67;
      goTo(pageRef.current + (nextSide ? 1 : -1));
    },
    [goTo, width],
  );

  const onTapRef = useRef(handleTap);
  onTapRef.current = handleTap;

  const renderPage = useCallback(
    ({ item }: { item: string }) => (
      <ReaderPage
        uri={item}
        width={width}
        height={height}
        remote={remote}
        onTap={(x) => onTapRef.current(x)}
      />
    ),
    [width, height, remote],
  );

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
    const index = viewableItems[0]?.index;
    if (typeof index !== 'number' || index === pageRef.current) {
      return;
    }
    pageRef.current = index;
    setPage(index);
    persistPageRef.current(index);
  }).current;

  useEffect(() => {
    if (!uiVisible || loading) {
      return;
    }
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
    }
    hideTimer.current = setTimeout(() => setUiVisible(false), 2800);
    return () => {
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
      }
    };
  }, [uiVisible, loading, page]);

  if (loading) {
    return (
      <View style={styles.center}>
        <StatusBar hidden />
        <Text style={styles.loadingKicker}>{remote ? 'CARGANDO CAPÍTULO' : 'CARGANDO TOMO'}</Text>
        <Text style={styles.loadingTitle} numberOfLines={2}>
          {comic.series ? `${comic.series}\n${comic.volumeLabel}` : comic.displayName}
        </Text>
        <ActivityIndicator color={colors.accent2} style={{ marginVertical: 18 }} />
        <Text style={styles.loadingCopy}>{status}</Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.max(8, ratio * 100)}%` }]} />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingKicker}>ERROR</Text>
        <Text style={styles.loadingTitle}>No se pudo abrir</Text>
        <Text style={styles.loadingCopy}>{error}</Text>
        <Pressable onPress={() => navigation.goBack()} style={styles.backPill}>
          <Text style={styles.backPillText}>Volver</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar hidden />
      <FlatList
        key={rtl ? 'manga' : 'comic'}
        ref={listRef}
        data={pages}
        horizontal
        pagingEnabled
        inverted={rtl}
        initialScrollIndex={Math.min(page, Math.max(pages.length - 1, 0))}
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
        keyExtractor={(item) => item}
        windowSize={5}
        maxToRenderPerBatch={3}
        initialNumToRender={3}
        updateCellsBatchingPeriod={16}
        removeClippedSubviews={false}
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 55 }}
        onMomentumScrollEnd={(event) => {
          const raw = Math.round(event.nativeEvent.contentOffset.x / width);
          const index = rtlRef.current ? Math.max(0, pages.length - 1 - raw) : raw;
          if (index !== pageRef.current && index >= 0 && index < pages.length) {
            pageRef.current = index;
            setPage(index);
            persistPage(index);
          }
        }}
        onScrollToIndexFailed={({ index }) => {
          setTimeout(() => listRef.current?.scrollToIndex({ index, animated: false }), 80);
        }}
        renderItem={renderPage}
      />

      {uiVisible ? (
        <View
          style={[styles.chrome, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 }]}
          pointerEvents="box-none"
        >
          <View style={styles.topBar}>
            <Pressable onPress={() => navigation.goBack()} style={styles.backPill}>
              <Text style={styles.backPillText}>SALIR</Text>
            </Pressable>
            <Text style={styles.chromeTitle} numberOfLines={1}>
              {comic.series ? `${comic.series} · ${comic.volumeLabel}` : comic.displayName}
            </Text>
            <Pressable onPress={toggleDirection} style={[styles.modePill, rtl ? styles.modeManga : styles.modeComic]}>
              <Text style={styles.modePillText}>{rtl ? 'MANGA' : 'CÓMIC'}</Text>
            </Pressable>
            <Text style={styles.pageCount}>
              {page + 1}/{pages.length}
            </Text>
          </View>
          <View style={styles.bottomBar}>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={Math.max(pages.length - 1, 0)}
              step={1}
              value={page}
              minimumTrackTintColor={colors.accent2}
              maximumTrackTintColor="rgba(255,255,255,0.16)"
              thumbTintColor={colors.gold}
              onSlidingComplete={(value) => goTo(Math.round(value), false)}
            />
            <Text style={styles.hint}>
              {rtl
                ? 'Manga: deslizá o arrastrá a la derecha para avanzar'
                : 'Cómic: deslizá o arrastrá a la izquierda para avanzar'}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function makeStyles(colors: ColorTokens) {
  return StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000',
  },
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  loadingKicker: {
    fontFamily: fonts.displaySemi,
    fontSize: 12,
    letterSpacing: 3,
    color: colors.accent2,
    marginBottom: 10,
  },
  loadingTitle: {
    fontFamily: fonts.display,
    fontSize: 26,
    color: colors.text,
    textAlign: 'center',
  },
  loadingCopy: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
  track: {
    marginTop: 22,
    width: '70%',
    height: 6,
    borderRadius: 99,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 99,
    backgroundColor: colors.accent,
  },
  chrome: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 8,
  },
  backPill: {
    backgroundColor: colors.overlay,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  backPillText: {
    fontFamily: fonts.displaySemi,
    color: colors.text,
    fontSize: 12,
    letterSpacing: 0.8,
  },
  chromeTitle: {
    flex: 1,
    fontFamily: fonts.sansSemi,
    color: colors.text,
    fontSize: 14,
  },
  modePill: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
  },
  modeManga: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  modeComic: {
    backgroundColor: colors.accent2Soft,
    borderColor: colors.accent2,
  },
  modePillText: {
    fontFamily: fonts.displaySemi,
    color: colors.text,
    fontSize: 11,
    letterSpacing: 1,
  },
  pageCount: {
    fontFamily: fonts.display,
    color: colors.gold,
    fontSize: 14,
  },
  bottomBar: {
    marginHorizontal: 12,
    paddingHorizontal: 12,
    paddingTop: 6,
    borderRadius: 12,
    backgroundColor: colors.overlay,
    borderWidth: 1,
    borderColor: colors.accent2,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  hint: {
    textAlign: 'center',
    fontFamily: fonts.sans,
    color: colors.textMuted,
    fontSize: 12,
    marginTop: -4,
    marginBottom: 8,
  },
  });
}
