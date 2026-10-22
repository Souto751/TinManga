import { Image } from 'expo-image';
import { forwardRef, memo, ReactElement, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image as RNImage, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { MANGADEX_USER_AGENT } from '../online/mangadex/constants';

// Modo webtoon: las páginas van una debajo de la otra, a todo el ancho, y se
// leen deslizando hacia abajo. Cada página ocupa el alto que le corresponde
// según su proporción real (los webtoons suelen ser tiras muy altas), por eso
// se miden las imágenes antes de mostrarlas.
//
// Zoom: pellizcar o doble toque acerca toda la tira (no una página suelta),
// así se puede seguir deslizando hacia abajo con el zoom puesto. Con zoom,
// arrastrar de costado mueve la vista y dos dedos la mueven en cualquier dirección.

export type VerticalReaderHandle = {
  scrollToPage: (page: number, animated?: boolean) => void;
};

type Props = {
  /** Lista completa: [centinela anterior, ...páginas, centinela siguiente]. */
  data: string[];
  isSentinel: (item: string) => boolean;
  initialPage: number;
  width: number;
  height: number;
  remote: boolean;
  scrollEnabled: boolean;
  renderSentinel: (item: string, width: number, height: number) => ReactElement;
  /** Índice de la lista (0 = centinela anterior) que quedó a la vista. */
  onListIndex: (index: number) => void;
  onToggleUi: () => void;
};

const DEFAULT_RATIO = 1.45; // alto/ancho estimado mientras no se conoce la imagen
const MEASURE_BEHIND = 2;
const MEASURE_AHEAD = 8;
const MEASURE_CONCURRENCY = 4;
const MAX_ZOOM = 4;
const DOUBLE_TAP_ZOOM = 2.2;
const LOCAL_PRELOAD_LIMIT = 60; // en archivos locales se mide todo lo anterior a la página guardada (hasta este tope)

function measureRatio(uri: string, remote: boolean): Promise<number | null> {
  return new Promise((resolve) => {
    const ok = (w: number, h: number) => resolve(w > 0 && h > 0 ? h / w : null);
    const fail = () => resolve(null);
    if (remote) {
      RNImage.getSizeWithHeaders(uri, { 'User-Agent': MANGADEX_USER_AGENT }, ok, fail);
    } else {
      RNImage.getSize(uri, ok, fail);
    }
  });
}

const VerticalPage = memo(function VerticalPage({
  uri,
  width,
  height,
  remote,
  onMeasured,
}: {
  uri: string;
  width: number;
  height: number;
  remote: boolean;
  onMeasured: (uri: string, ratio: number) => void;
}) {
  return (
    <View style={{ width, height, backgroundColor: '#000' }}>
      <Image
        source={remote ? { uri, headers: { 'User-Agent': MANGADEX_USER_AGENT } } : { uri }}
        style={{ width, height }}
        contentFit="contain"
        cachePolicy="memory-disk"
        recyclingKey={uri}
        transition={0}
        allowDownscaling
        onLoad={(event) => {
          const { width: w, height: h } = event.source;
          if (w > 0 && h > 0) {
            onMeasured(uri, h / w);
          }
        }}
      />
    </View>
  );
});

export const VerticalReader = forwardRef<VerticalReaderHandle, Props>(function VerticalReader(
  { data, isSentinel, initialPage, width, height, remote, scrollEnabled, renderSentinel, onListIndex, onToggleUi },
  ref,
) {
  const listRef = useRef<FlatList<string>>(null);
  const offsetRef = useRef(0);
  const measured = useRef(new Set<string>());
  const pending = useRef<Record<string, number>>({});
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [ratios, setRatios] = useState<Record<string, number>>({});
  const knownRef = useRef<Record<string, number>>({});
  const [ready, setReady] = useState(false);
  const currentRef = useRef(initialPage);
  const pages = useMemo(() => data.filter((item) => !isSentinel(item)), [data, isSentinel]);

  // Las medidas llegan de a muchas: se aplican juntas para no re-renderizar la lista por cada una.
  const flush = useCallback(() => {
    flushTimer.current = null;
    const batch = pending.current;
    pending.current = {};
    if (Object.keys(batch).length) {
      Object.assign(knownRef.current, batch);
      setRatios((prev) => ({ ...prev, ...batch }));
    }
  }, []);

  const onMeasured = useCallback(
    (uri: string, ratio: number) => {
      measured.current.add(uri);
      const known = knownRef.current[uri];
      if (known !== undefined && Math.abs(known - ratio) < 0.002) {
        return;
      }
      pending.current[uri] = ratio;
      if (!flushTimer.current) {
        flushTimer.current = setTimeout(flush, 120);
      }
    },
    [flush],
  );

  const measureMany = useCallback(
    async (uris: string[]) => {
      const todo = uris.filter((uri) => !measured.current.has(uri));
      todo.forEach((uri) => measured.current.add(uri));
      for (let i = 0; i < todo.length; i += MEASURE_CONCURRENCY) {
        const chunk = todo.slice(i, i + MEASURE_CONCURRENCY);
        const results = await Promise.all(chunk.map((uri) => measureRatio(uri, remote)));
        chunk.forEach((uri, index) => {
          const ratio = results[index];
          if (ratio) {
            pending.current[uri] = ratio;
          } else {
            measured.current.delete(uri); // se reintenta con el onLoad de la imagen
          }
        });
        flush();
      }
    },
    [flush, remote],
  );

  // Antes de mostrar: medir lo necesario para que la página guardada quede bien ubicada.
  useEffect(() => {
    let cancelled = false;
    const start = remote ? Math.max(0, initialPage - MEASURE_BEHIND) : Math.max(0, initialPage - LOCAL_PRELOAD_LIMIT);
    void measureMany(pages.slice(start, initialPage + 4)).then(() => {
      if (!cancelled) {
        setReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
    // Solo al abrir el capítulo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages]);

  // En archivos locales medir el resto en segundo plano (es rápido); en MangaDex solo alrededor de la página actual.
  useEffect(() => {
    if (!ready || remote) {
      return;
    }
    const order = pages
      .map((uri, index) => ({ uri, distance: Math.abs(index - currentRef.current) }))
      .sort((a, b) => a.distance - b.distance)
      .map((item) => item.uri);
    void measureMany(order);
  }, [ready, remote, pages, measureMany]);

  useEffect(() => () => {
    if (flushTimer.current) {
      clearTimeout(flushTimer.current);
    }
  }, []);

  const layout = useMemo(() => {
    const lengths = data.map((item) =>
      isSentinel(item) ? height : Math.max(1, Math.round(width * (ratios[item] ?? DEFAULT_RATIO))),
    );
    const offsets: number[] = [];
    let acc = 0;
    for (const length of lengths) {
      offsets.push(acc);
      acc += length;
    }
    return { lengths, offsets };
  }, [data, isSentinel, ratios, width, height]);

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({ length: layout.lengths[index] ?? height, offset: layout.offsets[index] ?? 0, index }),
    [layout, height],
  );

  useImperativeHandle(
    ref,
    () => ({
      scrollToPage: (page: number, animated = true) => {
        const index = Math.min(Math.max(page, 0), pages.length - 1) + 1;
        listRef.current?.scrollToOffset({ offset: layout.offsets[index] ?? 0, animated });
      },
    }),
    [layout, pages.length],
  );

  // ---- Zoom (sobre toda la tira) ----
  const zoomRef = useRef(1);
  const [pinching, setPinching] = useState(false);
  const scale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const startScale = useSharedValue(1);
  const startTx = useSharedValue(0);
  const anchorX = useSharedValue(0);
  const anchorY = useSharedValue(0);
  const cx = width / 2;
  const cy = height / 2;
  const setZoom = useCallback((value: number) => {
    zoomRef.current = value;
  }, []);

  // Mientras hay dos dedos apoyados la lista no se desplaza: si se movía junto
  // con el pellizco, el punto elegido para el zoom terminaba corriéndose.
  // Se bloquea al apoyar el segundo dedo (antes de que empiece el gesto) y,
  // si igual llega algún desplazamiento, se devuelve a la posición fijada.
  const scrollLock = useRef<number | null>(null);
  const lockScroll = useCallback(() => {
    if (scrollLock.current !== null) {
      return;
    }
    scrollLock.current = offsetRef.current;
    listRef.current?.setNativeProps({ scrollEnabled: false });
    setPinching(true);
  }, []);
  const unlockScroll = useCallback(() => {
    if (scrollLock.current === null) {
      return;
    }
    scrollLock.current = null;
    listRef.current?.setNativeProps({ scrollEnabled: true });
    setPinching(false);
  }, []);

  const handleTap = useCallback(
    (pageY: number) => {
      if (pageY < height * 0.25 || pageY > height * 0.75) {
        // Con zoom se ve menos alto de tira: avanzar en proporción.
        const delta = ((pageY < height * 0.25 ? -1 : 1) * height * 0.8) / zoomRef.current;
        listRef.current?.scrollToOffset({ offset: Math.max(0, offsetRef.current + delta), animated: true });
        return;
      }
      onToggleUi();
    },
    [height, onToggleUi],
  );
  const tapRef = useRef(handleTap);
  tapRef.current = handleTap;
  const onTap = useCallback((pageY: number) => tapRef.current(pageY), []);

  const pinch = Gesture.Pinch()
    .onStart((event) => {
      startScale.value = scale.value;
      // Punto de la tira que está bajo los dedos: se mantiene ahí mientras se hace zoom.
      anchorX.value = (event.focalX - cx - tx.value) / scale.value;
      anchorY.value = (event.focalY - cy - ty.value) / scale.value;
      runOnJS(lockScroll)();
    })
    .onUpdate((event) => {
      // Al soltar, casi nunca se levantan los dos dedos a la vez: con uno solo
      // apoyado el "centro" del pellizco pasa a ser ese dedo y la vista saltaba.
      if (event.numberOfPointers < 2) {
        return;
      }
      const s = Math.min(MAX_ZOOM, Math.max(1, startScale.value * event.scale));
      const maxX = ((s - 1) * width) / 2;
      const maxY = ((s - 1) * height) / 2;
      scale.value = s;
      tx.value = Math.min(maxX, Math.max(-maxX, event.focalX - cx - s * anchorX.value));
      ty.value = Math.min(maxY, Math.max(-maxY, event.focalY - cy - s * anchorY.value));
    })
    .onEnd(() => {
      if (scale.value < 1.04) {
        scale.value = withTiming(1);
        tx.value = withTiming(0);
        ty.value = withTiming(0);
        runOnJS(setZoom)(1);
      } else {
        runOnJS(setZoom)(scale.value);
      }
    })
    .onFinalize(() => {
      runOnJS(unlockScroll)();
    });

  // Con zoom, arrastrar de costado recorre el ancho; el deslizamiento vertical sigue siendo de la lista.
  const panX = Gesture.Pan()
    .maxPointers(1)
    .activeOffsetX([-12, 12])
    .failOffsetY([-12, 12])
    .onStart(() => {
      startTx.value = tx.value;
    })
    .onUpdate((event) => {
      if (scale.value > 1.04) {
        const maxX = ((scale.value - 1) * width) / 2;
        tx.value = Math.min(maxX, Math.max(-maxX, startTx.value + event.translationX));
      }
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((event) => {
      if (scale.value > 1.2) {
        scale.value = withTiming(1);
        tx.value = withTiming(0);
        ty.value = withTiming(0);
        runOnJS(setZoom)(1);
        return;
      }
      const s = DOUBLE_TAP_ZOOM;
      const ax = (event.x - cx - tx.value) / scale.value;
      const ay = (event.y - cy - ty.value) / scale.value;
      const maxX = ((s - 1) * width) / 2;
      const maxY = ((s - 1) * height) / 2;
      scale.value = withTiming(s);
      tx.value = withTiming(Math.min(maxX, Math.max(-maxX, event.x - cx - s * ax)));
      ty.value = withTiming(Math.min(maxY, Math.max(-maxY, event.y - cy - s * ay)));
      runOnJS(setZoom)(s);
    });

  const singleTap = Gesture.Tap()
    .maxDistance(14)
    .onEnd((event) => {
      runOnJS(onTap)(event.absoluteY);
    });

  const gesture = Gesture.Simultaneous(pinch, panX, Gesture.Exclusive(doubleTap, singleTap));

  const zoomStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  const onListIndexRef = useRef(onListIndex);
  onListIndexRef.current = onListIndex;
  const lastIndex = data.length - 1;
  const lastIndexRef = useRef(lastIndex);
  lastIndexRef.current = lastIndex;
  const pagesRef = useRef(pages);
  pagesRef.current = pages;
  const measureRef = useRef(measureMany);
  measureRef.current = measureMany;
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
      const indexes = viewableItems.map((item) => item.index).filter((i): i is number => typeof i === 'number');
      if (!indexes.length) {
        return;
      }
      // Si el centinela del final está a la vista, gana (pasa al siguiente capítulo);
      // si no, la página de más arriba que esté a la vista es la actual.
      const index = indexes.includes(lastIndexRef.current) ? lastIndexRef.current : Math.min(...indexes);
      if (index > 0 && index < lastIndexRef.current) {
        currentRef.current = index - 1;
        const around = pagesRef.current.slice(Math.max(0, index - 1 - MEASURE_BEHIND), index + MEASURE_AHEAD);
        void measureRef.current(around);
      }
      onListIndexRef.current(index);
    },
  ).current;

  const renderItem = useCallback(
    ({ item, index }: { item: string; index: number }) => {
      if (isSentinel(item)) {
        return renderSentinel(item, width, height);
      }
      return (
        <VerticalPage
          uri={item}
          width={width}
          height={layout.lengths[index]}
          remote={remote}
          onMeasured={onMeasured}
        />
      );
    },
    [isSentinel, renderSentinel, width, height, layout, remote, onMeasured],
  );

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  const initialIndex = Math.min(Math.max(initialPage, 0), Math.max(pages.length - 1, 0)) + 1;

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={{ flex: 1, backgroundColor: '#000', overflow: 'hidden' }}
        onTouchStart={(event) => {
          if (event.nativeEvent.touches.length >= 2) {
            lockScroll();
          }
        }}
        onTouchEnd={(event) => {
          if (event.nativeEvent.touches.length < 2) {
            unlockScroll();
          }
        }}
        onTouchCancel={unlockScroll}
      >
        <Animated.View style={[{ flex: 1 }, zoomStyle]}>
    <FlatList
      ref={listRef}
      data={data}
      extraData={ratios}
      scrollEnabled={scrollEnabled && !pinching}
      initialScrollIndex={initialIndex}
      getItemLayout={getItemLayout}
      keyExtractor={(item, index) => (isSentinel(item) ? item : `${index}:${item}`)}
      windowSize={7}
      maxToRenderPerBatch={3}
      initialNumToRender={3}
      removeClippedSubviews
      showsVerticalScrollIndicator={false}
      // Si cambia el alto de una página de más arriba (se terminó de medir), la vista no salta.
      maintainVisibleContentPosition={{ minIndexForVisible: 1 }}
      onScroll={(event) => {
        const y = event.nativeEvent.contentOffset.y;
        if (scrollLock.current !== null && Math.abs(y - scrollLock.current) > 0.5) {
          listRef.current?.scrollToOffset({ offset: scrollLock.current, animated: false });
          return;
        }
        offsetRef.current = y;
      }}
      scrollEventThrottle={32}
      onViewableItemsChanged={onViewableItemsChanged}
      viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
      renderItem={renderItem}
    />
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
});
