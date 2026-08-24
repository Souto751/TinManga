import { Image } from 'expo-image';
import { memo, useEffect } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { MANGADEX_USER_AGENT } from '../online/mangadex/constants';

type Props = {
  uri: string;
  width: number;
  height: number;
  remote: boolean;
  onTap: (x: number) => void;
  onZoomChange?: (zoomed: boolean) => void;
};

export const ReaderPage = memo(function ReaderPage({
  uri,
  width,
  height,
  remote,
  onTap,
  onZoomChange,
}: Props) {
  const scale = useSharedValue(1);
  const startScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const startTx = useSharedValue(0);
  const startTy = useSharedValue(0);
  const zoomedFlag = useSharedValue(0);

  const notifyZoom = (value: number) => {
    onZoomChange?.(value > 1.04);
  };

  useEffect(() => {
    scale.value = 1;
    startScale.value = 1;
    tx.value = 0;
    ty.value = 0;
    zoomedFlag.value = 0;
    onZoomChange?.(false);
  }, [uri, onZoomChange, scale, startScale, tx, ty, zoomedFlag]);

  const pinch = Gesture.Pinch()
    .onBegin(() => {
      startScale.value = scale.value;
    })
    .onUpdate((event) => {
      scale.value = Math.min(4, Math.max(1, startScale.value * event.scale));
      const next = scale.value > 1.04 ? 1 : 0;
      if (next !== zoomedFlag.value) {
        zoomedFlag.value = next;
        runOnJS(notifyZoom)(scale.value);
      }
    })
    .onEnd(() => {
      if (scale.value < 1.04) {
        scale.value = withTiming(1);
        tx.value = withTiming(0);
        ty.value = withTiming(0);
        startScale.value = 1;
        zoomedFlag.value = 0;
        runOnJS(notifyZoom)(1);
      } else {
        startScale.value = scale.value;
        zoomedFlag.value = 1;
        runOnJS(notifyZoom)(scale.value);
      }
    });

  const pan = Gesture.Pan()
    .manualActivation(true)
    .onTouchesMove((_, state) => {
      if (scale.value > 1.04) {
        state.activate();
      } else {
        state.fail();
      }
    })
    .onBegin(() => {
      startTx.value = tx.value;
      startTy.value = ty.value;
    })
    .onUpdate((event) => {
      tx.value = startTx.value + event.translationX;
      ty.value = startTy.value + event.translationY;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1.2) {
        scale.value = withTiming(1);
        tx.value = withTiming(0);
        ty.value = withTiming(0);
        startScale.value = 1;
        zoomedFlag.value = 0;
        runOnJS(notifyZoom)(1);
      } else {
        scale.value = withTiming(2.4);
        startScale.value = 2.4;
        zoomedFlag.value = 1;
        runOnJS(notifyZoom)(2.4);
      }
    });

  const tap = Gesture.Tap()
    .maxDeltaX(14)
    .maxDeltaY(14)
    .onEnd((event) => {
      runOnJS(onTap)(event.x);
    });

  const composed = Gesture.Simultaneous(pinch, pan, Gesture.Exclusive(doubleTap, tap));

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={{ width, height, backgroundColor: '#000', overflow: 'hidden' }}>
        <Animated.View style={[{ width, height }, animatedStyle]}>
          <Image
            source={
              remote
                ? { uri, headers: { 'User-Agent': MANGADEX_USER_AGENT } }
                : { uri }
            }
            style={{ width, height }}
            contentFit="contain"
            cachePolicy="memory-disk"
            priority="high"
            recyclingKey={uri}
            transition={0}
            allowDownscaling
          />
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
});
