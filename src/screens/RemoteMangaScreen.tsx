import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenBackdrop } from '../components/ScreenBackdrop';
import { useApp } from '../context/AppContext';
import { RootStackParamList } from '../navigation/types';
import { getManga, listChapters } from '../online/mangadex/api';
import { comicFromRemoteChapter } from '../online/mangadex/comic';
import { RemoteChapter, RemoteManga } from '../online/mangadex/types';
import { ColorTokens, fonts } from '../theme';

function fold(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

export function RemoteMangaScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { mangaId, preview } = useRoute<RouteProp<RootStackParamList, 'RemoteManga'>>().params;
  const { colors, series, config } = useApp();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [manga, setManga] = useState<RemoteManga | null>(preview ?? null);
  const [chapters, setChapters] = useState<RemoteChapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void Promise.all([preview ? Promise.resolve(preview) : getManga(mangaId), listChapters(mangaId)])
      .then(([nextManga, nextChapters]) => {
        if (!cancelled) {
          setManga(nextManga);
          setChapters(nextChapters);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'No se pudo abrir este manga.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [mangaId, preview]);

  const localHit = useMemo(() => {
    if (!manga) {
      return undefined;
    }
    const needle = fold(manga.title);
    if (needle.length < 4) {
      return undefined;
    }
    return series.find((item) => {
      const name = fold(item.name);
      return name.includes(needle) || needle.includes(name);
    });
  }, [manga, series]);

  const openChapter = (chapter: RemoteChapter) => {
    if (!manga) {
      return;
    }
    navigation.navigate('Reader', { comic: comicFromRemoteChapter(manga, chapter) });
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
      <ScreenBackdrop />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 28 }} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Pressable onPress={() => navigation.goBack()} style={styles.back}>
            <Text style={styles.backText}>VOLVER</Text>
          </Pressable>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroCover}>
            {manga?.coverUri ? (
              <Image source={{ uri: manga.coverUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
            ) : (
              <LinearGradient colors={[colors.surface2, colors.accent]} style={StyleSheet.absoluteFill} />
            )}
          </View>
          <View style={styles.heroText}>
            <Text style={styles.kicker}>MANGADEX · SOLO LECTURA</Text>
            <Text style={styles.title}>{manga?.title ?? '…'}</Text>
            <Text style={styles.meta}>
              {[manga?.year, manga?.status, `${chapters.length} caps.`]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </View>
        </View>

        {localHit ? (
          <Pressable
            onPress={() => navigation.navigate('Series', { seriesId: localHit.id })}
            style={styles.localBanner}
          >
            <Text style={styles.localTitle}>Lo tenés en la biblioteca</Text>
            <Text style={styles.localCopy}>{localHit.name}</Text>
          </Pressable>
        ) : null}

        {manga?.description ? <Text style={styles.description}>{manga.description}</Text> : null}

        {manga?.tags.length ? (
          <Text style={styles.tags}>{manga.tags.join(' · ')}</Text>
        ) : null}

        <Text style={styles.section}>CAPÍTULOS EN ESPAÑOL</Text>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.accent2} />
          </View>
        ) : error ? (
          <Text style={styles.empty}>{error}</Text>
        ) : chapters.length === 0 ? (
          <Text style={styles.empty}>No hay capítulos en español para este título.</Text>
        ) : (
          <View style={styles.list}>
            {chapters.map((chapter) => {
              const progress = config.progress[`md:${chapter.id}`];
              const label = chapter.chapter === '?' ? 'Oneshot' : `Cap. ${chapter.chapter}`;
              return (
                <Pressable
                  key={chapter.id}
                  onPress={() => openChapter(chapter)}
                  style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                >
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{chapter.volume || '—'}</Text>
                  </View>
                  <View style={styles.rowBody}>
                    <Text style={styles.rowTitle}>
                      {label}
                      {chapter.title ? ` · ${chapter.title}` : ''}
                    </Text>
                    <Text style={styles.rowMeta}>
                      {progress
                        ? `Pág. ${progress.page + 1} de ${progress.total}`
                        : `${chapter.pages || '—'} págs. · ${chapter.language}`}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
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
    topBar: {
      paddingHorizontal: 20,
    },
    back: {
      alignSelf: 'flex-start',
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
      fontSize: 24,
      lineHeight: 28,
      color: colors.text,
    },
    meta: {
      marginTop: 10,
      fontFamily: fonts.sansMedium,
      fontSize: 13,
      color: colors.textMuted,
    },
    localBanner: {
      marginTop: 18,
      marginHorizontal: 20,
      padding: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.accent,
      backgroundColor: colors.accentSoft,
    },
    localTitle: {
      fontFamily: fonts.displaySemi,
      color: colors.accent,
      fontSize: 12,
      letterSpacing: 1,
    },
    localCopy: {
      marginTop: 4,
      fontFamily: fonts.sansSemi,
      color: colors.text,
      fontSize: 15,
    },
    description: {
      marginTop: 18,
      paddingHorizontal: 20,
      fontFamily: fonts.sans,
      fontSize: 14,
      lineHeight: 21,
      color: colors.textMuted,
    },
    tags: {
      marginTop: 10,
      paddingHorizontal: 20,
      fontFamily: fonts.sans,
      fontSize: 12,
      color: colors.gold,
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
    center: {
      paddingVertical: 24,
    },
    empty: {
      paddingHorizontal: 20,
      fontFamily: fonts.sans,
      color: colors.textMuted,
      lineHeight: 22,
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
      fontSize: 12,
    },
    rowBody: {
      flex: 1,
    },
    rowTitle: {
      fontFamily: fonts.sansSemi,
      fontSize: 15,
      color: colors.text,
    },
    rowMeta: {
      marginTop: 3,
      fontFamily: fonts.sans,
      fontSize: 12,
      color: colors.textMuted,
    },
  });
}
