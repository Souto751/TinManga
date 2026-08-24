import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useApp } from '../context/AppContext';
import { ColorTokens, fonts, radius } from '../theme';
import { ComicProgress } from '../types';
import { HudCorners } from './HudCorners';

type Props = {
  item: ComicProgress;
  coverUri?: string;
  onPress: () => void;
};

export function ContinueBanner({ item, coverUri, onPress }: Props) {
  const { colors } = useApp();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const ratio = item.total > 0 ? Math.min(1, (item.page + 1) / item.total) : 0;
  const image = coverUri ?? item.coverUri;
  const title = item.series || item.name;
  const meta = [item.volumeLabel, `Página ${item.page + 1} de ${item.total}`].filter(Boolean).join(' · ');

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && styles.pressed]}>
      <HudCorners style={styles.wrap} color={colors.accent}>
        {image ? (
          <Image source={{ uri: image }} style={styles.cover} contentFit="cover" />
        ) : (
          <LinearGradient colors={[colors.surface2, colors.accent]} style={styles.cover} />
        )}
        <View style={styles.body}>
          <Text style={styles.kicker}>CONTINUAR</Text>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          <Text style={styles.meta}>{meta}</Text>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.max(8, ratio * 100)}%` }]} />
          </View>
        </View>
      </HudCorners>
    </Pressable>
  );
}

function makeStyles(colors: ColorTokens) {
  return StyleSheet.create({
    wrap: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderRadius: 0,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'visible',
      padding: 10,
      gap: 14,
    },
    pressed: {
      opacity: 0.88,
    },
    cover: {
      width: 64,
      height: 92,
      borderRadius: 8,
      backgroundColor: colors.surface2,
    },
    body: {
      flex: 1,
      justifyContent: 'center',
    },
    kicker: {
      fontFamily: fonts.displaySemi,
      fontSize: 11,
      letterSpacing: 2,
      color: colors.accent,
      marginBottom: 4,
    },
    title: {
      fontFamily: fonts.sansSemi,
      fontSize: 16,
      color: colors.text,
    },
    meta: {
      marginTop: 4,
      fontFamily: fonts.sans,
      fontSize: 13,
      color: colors.textMuted,
    },
    track: {
      marginTop: 12,
      height: 4,
      borderRadius: radius.full,
      backgroundColor: colors.border,
    },
    fill: {
      height: '100%',
      borderRadius: radius.full,
      backgroundColor: colors.accent,
    },
  });
}
