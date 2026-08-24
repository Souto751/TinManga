import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenBackdrop } from '../components/ScreenBackdrop';
import { StatusChips } from '../components/StatusChips';
import { useApp } from '../context/AppContext';
import { RootStackParamList } from '../navigation/types';
import { ColorTokens, fonts } from '../theme';
import { localTrackingId } from '../tracking/ids';
import { Comic, ComicProgress } from '../types';

function volumeMeta(comic: Comic, progress?: ComicProgress): string {
  if (progress && progress.total > 0) {
    return `Pág. ${progress.page + 1} de ${progress.total}`;
  }
  return comic.filename;
}

export function SeriesScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { seriesId } = useRoute<RouteProp<RootStackParamList, 'Series'>>().params;
  const { series, config, colors, coverForSeries, assignSeriesCover, clearSeriesCover, resetProgress, upsertTracking, removeTracking, setReadingQueue } = useApp();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const item = series.find((entry) => entry.id === seriesId);

  if (!item) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 12, paddingHorizontal: 20 }]}>
        <ScreenBackdrop />
        <Pressable onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>VOLVER</Text>
        </Pressable>
        <Text style={styles.missing}>Esta serie ya no está en la carpeta.</Text>
      </View>
    );
  }

  const coverUri = coverForSeries(item);
  const hasCustomCover = Boolean(config.seriesCovers[item.id] || coverUri);
  const trackId = localTrackingId(item.id);
  const tracked = config.tracking[trackId];

  const openVolume = (comic: Comic) => {
    setReadingQueue(item.volumes);
    navigation.navigate('Reader', { comic });
  };

  const confirmVolume = (comic: Comic) => {
    Alert.alert(comic.volumeLabel, undefined, [
      {
        text: 'Reiniciar progreso',
        style: 'destructive',
        onPress: () => {
          void resetProgress(comic.id);
        },
      },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  const coverActions = () => {
    Alert.alert(
      item.name,
      'La tapa se puede tomar de una carpeta de imágenes (el archivo tiene que llamarse como la serie) o elegirla a mano.',
      [
        {
          text: 'Elegir imagen',
          onPress: () => {
            void assignSeriesCover(item).catch((err: Error) => {
              Alert.alert('No se pudo guardar la tapa', err.message);
            });
          },
        },
        config.seriesCovers[item.id]
          ? {
              text: 'Quitar tapa',
              style: 'destructive' as const,
              onPress: () => {
                void clearSeriesCover(item.id);
              },
            }
          : undefined,
        { text: 'Cancelar', style: 'cancel' as const },
      ].filter(Boolean) as { text: string; style?: 'destructive' | 'cancel'; onPress?: () => void }[],
    );
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
      <ScreenBackdrop />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 28 }} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Pressable onPress={() => navigation.goBack()} style={styles.back}>
            <Text style={styles.backText}>VOLVER</Text>
          </Pressable>
          <Pressable onPress={coverActions} style={styles.back}>
            <Text style={styles.backText}>TAPA</Text>
          </Pressable>
        </View>

        <View style={styles.hero}>
          <Pressable onPress={coverActions} onLongPress={coverActions} style={styles.heroCover}>
            {coverUri ? (
              <Image source={{ uri: coverUri }} style={StyleSheet.absoluteFill} contentFit="cover" recyclingKey={coverUri} />
            ) : (
              <LinearGradient colors={[colors.surface2, colors.accent]} style={StyleSheet.absoluteFill}>
                <View style={styles.letterWrap}>
                  <Text style={styles.letter}>{item.name.slice(0, 1).toUpperCase()}</Text>
                </View>
              </LinearGradient>
            )}
          </Pressable>
          <View style={styles.heroText}>
            <Text style={styles.kicker}>{hasCustomCover ? 'Mantene presionado para cambiar la tapa' : 'Sin tapa aún'}</Text>
            <Text style={styles.title}>{item.name}</Text>
            <Text style={styles.count}>
              {item.volumes.length === 1 ? '1 tomo' : `${item.volumes.length} tomos`}
            </Text>
          </View>
        </View>

        <View style={styles.trackBox}>
          <StatusChips
            value={tracked?.status}
            onChange={(status) => {
              void upsertTracking({
                id: trackId,
                source: 'local',
                title: item.name,
                coverUri,
                status,
                localSeriesId: item.id,
                updatedAt: Date.now(),
              });
            }}
          />
          {tracked ? (
            <Pressable onPress={() => void removeTracking(trackId)} style={styles.removeTrack}>
              <Text style={styles.removeTrackText}>Quitar de la lista</Text>
            </Pressable>
          ) : null}
        </View>

        <Text style={styles.section}>TOMOS</Text>
        <View style={styles.list}>
          {item.volumes.map((comic) => {
            const progress = config.progress[comic.id];
            const ratio = progress && progress.total > 0 ? (progress.page + 1) / progress.total : 0;
            return (
              <Pressable
                key={comic.id}
                onPress={() => openVolume(comic)}
                onLongPress={() => confirmVolume(comic)}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              >
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{comic.volume ?? '—'}</Text>
                </View>
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle}>{comic.volumeLabel}</Text>
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {volumeMeta(comic, progress)}
                  </Text>
                  {ratio > 0 ? (
                    <View style={styles.track}>
                      <View style={[styles.fill, { width: `${Math.max(8, ratio * 100)}%` }]} />
                    </View>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

function makeStyles(colors: ColorTokens) {
  return StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  missing: {
    marginTop: 24,
    fontFamily: fonts.sans,
    color: colors.textMuted,
  },
  topBar: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  back: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  backText: {
    fontFamily: fonts.displaySemi,
    color: colors.text,
    fontSize: 12,
    letterSpacing: 1,
  },
  hero: {
    paddingHorizontal: 20,
    paddingTop: 22,
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },
  heroCover: {
    width: 118,
    height: 176,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  letterWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: {
    fontFamily: fonts.display,
    fontSize: 56,
    color: '#F4F1FF',
  },
  heroText: {
    flex: 1,
  },
  kicker: {
    fontFamily: fonts.displaySemi,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.accent2,
    marginBottom: 8,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 26,
    lineHeight: 30,
    color: colors.text,
  },
  count: {
    marginTop: 10,
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: colors.textMuted,
  },
  trackBox: {
    marginTop: 18,
    paddingHorizontal: 20,
    gap: 8,
  },
  removeTrack: {
    alignSelf: 'flex-start',
  },
  removeTrackText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
  },
  section: {
    marginTop: 28,
    marginBottom: 12,
    paddingHorizontal: 20,
    fontFamily: fonts.displaySemi,
    fontSize: 12,
    letterSpacing: 2.2,
    color: colors.gold,
  },
  list: {
    paddingHorizontal: 20,
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
  },
  pressed: {
    opacity: 0.86,
  },
  badge: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.accent2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: fonts.display,
    color: colors.accent2,
    fontSize: 14,
  },
  rowBody: {
    flex: 1,
  },
  rowTitle: {
    fontFamily: fonts.sansSemi,
    fontSize: 16,
    color: colors.text,
  },
  rowMeta: {
    marginTop: 3,
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
  },
  track: {
    marginTop: 8,
    height: 3,
    borderRadius: 99,
    backgroundColor: colors.border,
  },
  fill: {
    height: '100%',
    borderRadius: 99,
    backgroundColor: colors.accent,
  },
  });
}
