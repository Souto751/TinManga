import { ReactNode } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';

type Props = {
  children?: ReactNode;
  style?: ViewStyle | ViewStyle[];
  color: string;
};

export function HudCorners({ children, style, color }: Props) {
  return (
    <View style={style}>
      {children}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={[styles.h, styles.tl, { backgroundColor: color }]} />
        <View style={[styles.v, styles.tl, { backgroundColor: color }]} />
        <View style={[styles.h, styles.tr, { backgroundColor: color }]} />
        <View style={[styles.v, styles.tr, { backgroundColor: color }]} />
        <View style={[styles.h, styles.bl, { backgroundColor: color }]} />
        <View style={[styles.v, styles.bl, { backgroundColor: color }]} />
        <View style={[styles.h, styles.br, { backgroundColor: color }]} />
        <View style={[styles.v, styles.br, { backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  h: {
    position: 'absolute',
    width: 14,
    height: 2,
  },
  v: {
    position: 'absolute',
    width: 2,
    height: 14,
  },
  tl: {
    top: 0,
    left: 0,
  },
  tr: {
    top: 0,
    right: 0,
  },
  bl: {
    bottom: 0,
    left: 0,
  },
  br: {
    bottom: 0,
    right: 0,
  },
});
