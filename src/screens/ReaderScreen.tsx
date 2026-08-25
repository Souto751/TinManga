import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
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
import { getChapterPages, listChapters } from '../online/mangadex/api';
import { comicFromRemoteChapter } from '../online/mangadex/comic';
import { isRemoteChapterUri, remoteChapterId } from '../online/mangadex/constants';
import { ReaderPage } from '../reader/ReaderPage';
import { pagesAround, prefetchPageUrls, resetPagePrefetch, waitWithTimeout } from '../reader/prefetchPages';
import { ColorTokens, fonts } from '../theme';

const PREV = '__prev__';
const NEXT = '__next__';

export function ReaderScreen() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { comic } = useRoute<RouteProp<RootStackParamList, 'Reader'>>().params;
  const { config, colors, saveProgress, setReadingDirection, series, readingQueue, setReadingQueue } = useApp();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const listRef = useRef<FlatList<string>>(null);
  const pageRef = useRef(0);
  const savedPage = useRef(config.progress[comic.id]?.page ?? 0);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rtlRef = useRef(config.readingDirection === 'rtl');
  const pagesLenRef = useRef(0);
  const ignoreSentinelUntil = useRef(0);
  const queueReadyRef = useRef(false);
  const remoteQueueTried = useRef('');

  const [pages, setPages] = useState<string[]>([]);
  const [page, setPage] = useState(savedPage.current);
  const [uiVisible, setUiVisible] = useState(true);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('Abriendo…');
  const [ratio, setRatio] = useState(0.05);
  const [error, setError] = useState<string | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const [sentinel, setSentinel] = useState<'prev' | 'next' | null>(null);
  const [scrubPage, setScrubPage] = useState<number | null>(null);
  // Mientras el dedo está tocando la barra de abajo (el slider), se
  // deshabilita el scroll horizontal del lector. Sin esto, a veces un toque
  // en la barra se interpretaba como un arrastre sobre las páginas y
  // terminaba cambiando de página por scroll en lugar de mover el slider.
  const [barTouching, setBarTouching] = useState(false);

  const rtl = config.readingDirection === 'rtl';
  rtlRef.current = rtl;
  const remote = isRemoteChapterUri(comic.uri);
  pagesLenRef.current = pages.length;
  queueReadyRef.current =
    !remote ||
    remoteQueueTried.current === comic.id ||
    (readingQueue.length > 1 && readingQueue.some((item) => item.id === comic.id));

  const neighbors = useMemo(() => {
    const index = readingQueue.findIndex((item) => item.id === comic.id);
    if (index < 0) {
      return { prev: undefined, next: undefined };
    }
    return {
      prev: readingQueue[index - 1],
      next: readingQueue[index + 1],
    };
  }, [readingQueue, comic.id]);
  const neighborsRef = useRef(neighbors);
  neighborsRef.current = neighbors;

  const listData = useMemo(() => (pages.length ? [PREV, ...pages, NEXT] : []), [pages]);

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
    const local = series.find((item) => item.volumes.some((volume) => volume.id === comic.id));
    if (local) {
      const same =
        readingQueue.length === local.volumes.length &&
        readingQueue.every((item, index) => item.id === local.volumes[index]?.id);
      if (!same) {
        setReadingQueue(local.volumes);
      }
      return;
    }
    if (isRemoteChapterUri(comic.uri) && comic.seriesId) {
      if (readingQueue.length > 1 && readingQueue.some((item) => item.id === comic.id)) {
        return;
      }
      if (remoteQueueTried.current === comic.id) {
        return;
      }
      let cancelled = false;
      void listChapters(comic.seriesId)
        .then((chapters) => {
          if (cancelled) {
            return;
          }
          remoteQueueTried.current = comic.id;
          const queue = chapters.map((chapter) =>
            comicFromRemoteChapter(
              {
                id: comic.seriesId,
                title: comic.series,
                description: '',
                status: '',
                tags: [],
                coverUri: comic.coverUri,
              },
              chapter,
            ),
          );
          setReadingQueue(queue.some((item) => item.id === comic.id) ? queue : [comic]);
        })
        .catch(() => {
          if (!cancelled) {
            remoteQueueTried.current = comic.id;
            setReadingQueue([comic]);
          }
        });
      return () => {
        cancelled = true;
      };
    }
    if (!readingQueue.some((item) => item.id === comic.id)) {
      setReadingQueue([comic]);
    }
  }, [comic, readingQueue, series, setReadingQueue]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        setZoomed(false);
        setSentinel(null);
        savedPage.current = config.progress[comic.id]?.page ?? 0;
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
        ignoreSentinelUntil.current = Date.now() + 700;
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
  const setSentinelRef = useRef(setSentinel);
  setSentinelRef.current = setSentinel;
  const applyListIndexRef = useRef((index: number) => {
    const len = pagesLenRef.current;
    if (index === 0 || index === len + 1) {
      if (Date.now() < ignoreSentinelUntil.current) {
        return;
      }
      setSentinelRef.current(index === 0 ? 'prev' : 'next');
      return;
    }
    setSentinelRef.current(null);
    const real = index - 1;
    if (real < 0 || real >= len || real === pageRef.current) {
      return;
    }
    pageRef.current = real;
    setPage(real);
    persistPageRef.current(real);
  });

  const openNeighbor = useCallback(
    (dir: 'prev' | 'next') => {
      const target = dir === 'next' ? neighborsRef.current.next : neighborsRef.current.prev;
      if (!target) {
        setSentinel(null);
        if (dir === 'prev') {
          listRef.current?.scrollToIndex({ index: 1, animated: true });
        } else if (!queueReadyRef.current) {
          listRef.current?.scrollToIndex({ index: Math.max(pages.length, 1), animated: true });
        } else {
          navigation.goBack();
        }
        return;
      }
      if (dir === 'next' && pages.length > 0) {
        void saveProgress(comic, pages.length - 1, pages.length);
      }
      navigation.replace('Reader', { comic: target });
    },
    [comic, navigation, pages.length, saveProgress],
  );

  useEffect(() => {
    if (!sentinel) {
      return;
    }
    const timer = setTimeout(() => openNeighbor(sentinel), 420);
    return () => clearTimeout(timer);
  }, [sentinel, openNeighbor]);

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
      if (next >= pages.length) {
        openNeighbor('next');
        return;
      }
      if (next < 0) {
        openNeighbor('prev');
        return;
      }
      if (next === pageRef.current) {
        return;
      }
      pageRef.current = next;
      setPage(next);
      listRef.current?.scrollToIndex({ index: next + 1, animated: true });
      persistPage(next);
      if (haptic) {
        void Haptics.selectionAsync();
      }
    },
    [openNeighbor, pages.length, persistPage],
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
    ({ item }: { item: string }) => {
      if (item === PREV || item === NEXT) {
        const neighbor = item === NEXT ? neighbors.next : neighbors.prev;
        const goingNext = item === NEXT;
        return (
          <View style={[styles.sentinel, { width, height }]}>
            <Text style={styles.sentinelKicker}>{goingNext ? 'SIGUIENTE' : 'ANTERIOR'}</Text>
            <Text style={styles.sentinelTitle}>
              {neighbor
                ? neighbor.volumeLabel
                : goingNext
                  ? 'Fin'
                  : 'Inicio'}
            </Text>
            <Text style={styles.sentinelCopy} numberOfLines={3}>
              {neighbor
                ? neighbor.series || neighbor.displayName
                : goingNext
                  ? 'No hay más capítulos en la cola'
                  : 'Este es el primero'}
            </Text>
          </View>
        );
      }
      return (
        <ReaderPage
          uri={item}
          width={width}
          height={height}
          remote={remote}
          onTap={(x) => onTapRef.current(x)}
          onZoomChange={setZoomed}
        />
      );
    },
    [width, height, remote, neighbors.next, neighbors.prev, styles],
  );

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
      const index = viewableItems[0]?.index;
      if (typeof index === 'number') {
        applyListIndexRef.current(index);
      }
    },
  ).current;

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
        data={listData}
        extraData={`${neighbors.prev?.id ?? ''}:${neighbors.next?.id ?? ''}`}
        horizontal
        pagingEnabled
        inverted={rtl}
        scrollEnabled={!zoomed && !barTouching}
        initialScrollIndex={Math.min(page, Math.max(pages.length - 1, 0)) + 1}
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
        keyExtractor={(item, index) => (item === PREV || item === NEXT ? item : `${index}:${item}`)}
        windowSize={5}
        maxToRenderPerBatch={3}
        initialNumToRender={3}
        updateCellsBatchingPeriod={16}
        removeClippedSubviews={false}
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 55 }}
        onMomentumScrollEnd={(event) => {
          // `inverted` es un transform visual (scaleX: -1): la lista se ve
          // espejada pero el offset sigue mapeando 1 a 1 al índice de datos
          // en los dos modos. Invertirlo acá también (como hacía antes)
          // duplicaba la inversión y en modo manga terminaba calculando la
          // página al revés — a veces "avanzaba" hacia la anterior y el
          // contador de páginas quedaba desincronizado del real.
          const index = Math.round(event.nativeEvent.contentOffset.x / width);
          applyListIndexRef.current(index);
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
          <View
            style={styles.bottomBar}
            onTouchStart={() => setBarTouching(true)}
            onTouchEnd={() => setBarTouching(false)}
            onTouchCancel={() => setBarTouching(false)}
          >
            {scrubPage !== null ? (
              <View style={styles.scrubBubble} pointerEvents="none">
                <View style={styles.scrubBubbleInner}>
                  <Text style={styles.scrubBubbleText}>
                    Pág. {scrubPage + 1}/{pages.length}
                  </Text>
                </View>
              </View>
            ) : null}
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={Math.max(pages.length - 1, 0)}
              step={1}
              value={page}
              minimumTrackTintColor={colors.accent2}
              maximumTrackTintColor="rgba(255,255,255,0.16)"
              thumbTintColor={colors.gold}
              onSlidingStart={(value) => setScrubPage(Math.round(value))}
              onValueChange={(value) => setScrubPage(Math.round(value))}
              onSlidingComplete={(value) => {
                setScrubPage(null);
                setBarTouching(false);
                goTo(Math.round(value), false);
              }}
            />
            <Text style={styles.hint}>
              {rtl
                ? 'Pellizcá o doble toque para zoom · al final, deslizá para el siguiente capítulo'
                : 'Pellizcá o doble toque para zoom · al final, deslizá para el siguiente tomo'}
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
  scrubBubble: {
    position: 'absolute',
    top: -42,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  scrubBubbleInner: {
    backgroundColor: colors.overlay,
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  scrubBubbleText: {
    fontFamily: fonts.displaySemi,
    color: colors.gold,
    fontSize: 13,
    letterSpacing: 0.4,
  },
  hint: {
    textAlign: 'center',
    fontFamily: fonts.sans,
    color: colors.textMuted,
    fontSize: 12,
    marginTop: -4,
    marginBottom: 8,
  },
  sentinel: {
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
  },
  sentinelKicker: {
    fontFamily: fonts.displaySemi,
    fontSize: 12,
    letterSpacing: 3,
    color: colors.accent2,
    marginBottom: 10,
  },
  sentinelTitle: {
    fontFamily: fonts.display,
    fontSize: 28,
    color: colors.text,
    textAlign: 'center',
  },
  sentinelCopy: {
    marginTop: 10,
    fontFamily: fonts.sans,
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
  },
  });
}
