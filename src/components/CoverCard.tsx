import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useApp } from '../context/AppContext';
import { ColorTokens, coverPalette, fonts, radius } from '../theme';

type Props = {
  id: string;
  title: string;
  subtitle: string;
  coverUri?: string;
  progressRatio?: number;
  onPress: () => void;
  onLongPress?: () => void;
};

function paletteFor(id: string): [string, string] {
  let sum = 0;
  for (let i = 0; i < id.length; i += 1) {
    sum += id.charCodeAt(i);
  }
  const pair = coverPalette[sum % coverPalette.length];
  return [pair[0], pair[1]];
}

export function CoverCard({ id, title, subtitle, coverUri, progressRatio, onPress, onLongPress }: Props) {
  const { colors } = useApp();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [start, end] = paletteFor(id);
  const ratio = Math.max(0, Math.min(1, progressRatio ?? 0));

  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.cover}>
        {coverUri ? (
          <Image source={{ uri: coverUri }} style={StyleSheet.absoluteFill} contentFit="cover" recyclingKey={coverUri} />
        ) : (
          <LinearGradient colors={[start, end]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <View style={styles.letterWrap}>
              <Text style={styles.letter}>{title.slice(0, 1).toUpperCase()}</Text>
            </View>
          </LinearGradient>
        )}
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.55)']} style={styles.coverShade} />
        {progressRatio != null && progressRatio > 0 ? (
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.max(6, ratio * 100)}%` }]} />
          </View>
        ) : null}
      </View>
      <Text style={styles.title} numberOfLines={2}>
        {title}
      </Text>
      <Text style={styles.meta} numberOfLines={1}>
        {subtitle}
      </Text>
    </Pressable>
  );
}

function makeStyles(colors: ColorTokens) {
  return StyleSheet.create({
    card: {
      flex: 1,
    },
    pressed: {
      opacity: 0.82,
      transform: [{ scale: 0.985 }],
    },
    cover: {
      aspectRatio: 2 / 3,
      borderRadius: 10,
      overflow: 'hidden',
      backgroundColor: colors.surface2,
      borderWidth: 1,
      borderColor: colors.border,
    },
    coverShade: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: 48,
    },
    letterWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    letter: {
      fontFamily: fonts.display,
      fontSize: 54,
      color: '#F4F1FF',
      opacity: 0.9,
    },
    progressTrack: {
      position: 'absolute',
      left: 8,
      right: 8,
      bottom: 8,
      height: 3,
      borderRadius: radius.full,
      backgroundColor: 'rgba(255,255,255,0.18)',
    },
    progressFill: {
      height: '100%',
      borderRadius: radius.full,
      backgroundColor: colors.accent,
    },
    title: {
      marginTop: 10,
      fontFamily: fonts.sansSemi,
      fontSize: 14,
      lineHeight: 18,
      color: colors.text,
    },
    meta: {
      marginTop: 3,
      fontFamily: fonts.sans,
      fontSize: 12,
      color: colors.textMuted,
    },
  });
}
