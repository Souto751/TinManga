import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenBackdrop } from '../components/ScreenBackdrop';
import { StatusChips } from '../components/StatusChips';
import { useApp } from '../context/AppContext';
import { RootStackParamList } from '../navigation/types';
import { chapterSortValue, getManga, listChapters } from '../online/mangadex/api';
import { comicFromRemoteChapter } from '../online/mangadex/comic';
import { API_LANGUAGE_LABELS } from '../online/mangadex/constants';
import { RemoteChapter, RemoteManga } from '../online/mangadex/types';
import { isProgressComplete } from '../storage/progress';
import { ColorTokens, fonts } from '../theme';
import { mangaTrackingId } from '../tracking/ids';

function fold(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

function chapterLabel(chapter: RemoteChapter): string {
  const label = chapter.chapter === '?' ? 'Oneshot' : `Cap. ${chapter.chapter}`;
  return chapter.title ? `${label} · ${chapter.title}` : label;
}

// Cuántos capítulos se muestran de entrada y cuántos más se suman cada vez
// que se llega al final del scroll. La lista completa ya está en memoria
// (listChapters la trae entera), así que "cargar más" es solo mostrar más
// de lo que ya tenemos — no dispara ningún pedido nuevo a la API.
const CHAPTERS_PAGE_SIZE = 20;

export function RemoteMangaScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { mangaId, preview } = useRoute<RouteProp<RootStackParamList, 'RemoteManga'>>().params;
  const { colors, series, config, upsertTracking, removeTracking, markComicsRead, setReadingQueue } = useApp();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [manga, setManga] = useState<RemoteManga | null>(preview ?? null);
  const [chapters, setChapters] = useState<RemoteChapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [visibleCount, setVisibleCount] = useState(CHAPTERS_PAGE_SIZE);
  const languageLabel = API_LANGUAGE_LABELS[config.apiLanguage];

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setVisibleCount(CHAPTERS_PAGE_SIZE);
    (async () => {
      try {
        // Primero resolvemos el manga (o usamos el preview que ya trajo
        // Explorar) para conocer su contentRating, y recién con eso
        // pedimos los capítulos — así listChapters puede pedir un solo
        // rating en vez de probar los 4 a ciegas.
        const nextManga = preview ?? (await getManga(mangaId));
        if (cancelled) {
          return;
        }
        setManga(nextManga);
        const nextChapters = await listChapters(mangaId, nextManga.contentRating);
        if (!cancelled) {
          setChapters(nextChapters);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'No se pudo abrir este manga.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
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

  const sortedChapters = useMemo(() => {
    const copy = [...chapters];
    copy.sort((a, b) => {
      const diff = chapterSortValue(a) - chapterSortValue(b);
      return sortAsc ? diff : -diff;
    });
    return copy;
  }, [chapters, sortAsc]);

  // Al invertir el orden, "los primeros" pasan a ser otros capítulos —
  // arrancamos de nuevo desde el principio de la lista visible.
  useEffect(() => {
    setVisibleCount(CHAPTERS_PAGE_SIZE);
  }, [sortAsc]);

  const visibleChapters = useMemo(
    () => sortedChapters.slice(0, visibleCount),
    [sortedChapters, visibleCount],
  );

  const loadMoreChapters = useCallback(() => {
    setVisibleCount((count) => Math.min(count + CHAPTERS_PAGE_SIZE, sortedChapters.length));
  }, [sortedChapters.length]);

  const readCount = useMemo(
    () => chapters.filter((chapter) => isProgressComplete(config.progress[`md:${chapter.id}`])).length,
    [chapters, config.progress],
  );

  const openChapter = (chapter: RemoteChapter) => {
    if (!manga) {
      return;
    }
    if (chapter.externalUrl) {
      // No hay páginas para pedirle a MangaDex — se lee en el lector
      // oficial (MangaPlus/Viz). openBrowserAsync usa Chrome Custom Tabs:
      // técnicamente nunca salís de la tarea de TinMangas (por eso "volver
      // atrás" te trae de nuevo acá), pero por defecto se ve con la barra
      // de Chrome de fábrica. Le pasamos los colores del tema para que al
      // menos visualmente combine con la app en vez de parecer otra app.
      void WebBrowser.openBrowserAsync(chapter.externalUrl, {
        toolbarColor: colors.bg,
        secondaryToolbarColor: colors.surface,
        showTitle: true,
        enableDefaultShareMenuItem: false,
      });
      return;
    }
    setReadingQueue(
      [...chapters]
        .sort((a, b) => chapterSortValue(a) - chapterSortValue(b))
        .map((item) => comicFromRemoteChapter(manga, item)),
    );
    navigation.navigate('Reader', { comic: comicFromRemoteChapter(manga, chapter) });
  };

  const toggleRead = (chapter: RemoteChapter) => {
    if (!manga) {
      return;
    }
    const comic = comicFromRemoteChapter(manga, chapter);
    const read = isProgressComplete(config.progress[comic.id]);
    void markComicsRead([comic], !read);
  };

  const markUntil = (chapter: RemoteChapter) => {
    if (!manga) {
      return;
    }
    const limit = chapterSortValue(chapter);
    const batch = chapters
      .filter((item) => chapterSortValue(item) <= limit)
      .map((item) => comicFromRemoteChapter(manga, item));
    void markComicsRead(batch, true);
  };

  const chapterActions = (chapter: RemoteChapter) => {
    const read = isProgressComplete(config.progress[`md:${chapter.id}`]);
    Alert.alert(chapterLabel(chapter), 'El marcado es local, para capítulos que ya leíste en otro lado.', [
      {
        text: read ? 'Quitar leído' : 'Marcar leído',
        onPress: () => toggleRead(chapter),
      },
      {
        text: 'Marcar hasta este capítulo',
        onPress: () => markUntil(chapter),
      },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  const trackId = mangaTrackingId(mangaId);
  const tracked = config.tracking[trackId];

  const header = (
    <View>
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
            {[manga?.year, manga?.status, chapters.length ? `${chapters.length} caps.` : null, readCount ? `${readCount} leídos` : null]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>
      </View>

      <View style={styles.trackBox}>
        <StatusChips
          value={tracked?.status}
          onChange={(status) => {
            if (!manga) {
              return;
            }
            void upsertTracking({
              id: trackId,
              source: 'mangadex',
              title: manga.title,
              coverUri: manga.coverUri,
              status,
              mangaId: manga.id,
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

      {manga?.tags.length ? <Text style={styles.tags}>{manga.tags.join(' · ')}</Text> : null}

      <View style={styles.sectionRow}>
        <Text style={styles.section}>CAPÍTULOS · {languageLabel.toUpperCase()}</Text>
        {chapters.length > 0 ? (
          <Pressable onPress={() => setSortAsc((value) => !value)} style={styles.sort}>
            <Text style={styles.sortText}>{sortAsc ? '1 → N' : 'N → 1'}</Text>
          </Pressable>
        ) : null}
      </View>
      {chapters.length > 0 ? (
        <Text style={styles.markHint}>Tocá MARCAR si ya lo leíste. Mantené presionado para marcar hasta ese número.</Text>
      ) : null}
    </View>
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
      <ScreenBackdrop />
      {loading ? (
        <View style={styles.flex}>
          {header}
          <View style={styles.center}>
            <ActivityIndicator color={colors.accent2} />
            <Text style={styles.empty}>Cargando el listado completo…</Text>
          </View>
        </View>
      ) : error ? (
        <View style={styles.flex}>
          {header}
          <Text style={styles.empty}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={visibleChapters}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={header}
          ListEmptyComponent={
            <Text style={styles.empty}>No hay capítulos en {languageLabel.toLowerCase()} para este título.</Text>
          }
          ListFooterComponent={
            visibleCount < sortedChapters.length ? (
              <View style={styles.loadMoreHint}>
                <ActivityIndicator color={colors.accent2} />
                <Text style={styles.loadMoreText}>
                  Cargando más capítulos… ({visibleChapters.length}/{sortedChapters.length})
                </Text>
              </View>
            ) : null
          }
          onEndReached={loadMoreChapters}
          onEndReachedThreshold={0.6}
          contentContainerStyle={{ paddingBottom: insets.bottom + 28 }}
          showsVerticalScrollIndicator={false}
          initialNumToRender={16}
          windowSize={8}
          renderItem={({ item }) => {
            const progress = config.progress[`md:${item.id}`];
            const read = isProgressComplete(progress);
            const external = Boolean(item.externalUrl);
            return (
              <View style={styles.rowWrap}>
                <Pressable
                  onPress={() => openChapter(item)}
                  onLongPress={() => chapterActions(item)}
                  delayLongPress={280}
                  style={({ pressed }) => [
                    styles.row,
                    read && styles.rowRead,
                    external && styles.rowExternal,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={[styles.badge, external && styles.badgeExternal]}>
                    <Text style={styles.badgeText}>{item.chapter === '?' ? '—' : item.chapter}</Text>
                  </View>
                  <View style={styles.rowBody}>
                    <Text style={styles.rowTitle}>{chapterLabel(item)}</Text>
                    <Text style={styles.rowMeta}>
                      {external
                        ? 'Solo en MangaPlus/oficial · toca para abrir'
                        : read
                          ? 'Leído'
                          : progress
                            ? `Pág. ${progress.page + 1} de ${progress.total}`
                            : `${item.pages || '—'} págs. · ${item.language}`}
                    </Text>
                  </View>
                </Pressable>
                <Pressable onPress={() => toggleRead(item)} style={[styles.mark, read && styles.markOn]}>
                  <Text style={[styles.markText, read && styles.markTextOn]}>{read ? 'LEÍDO' : 'MARCAR'}</Text>
                </Pressable>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

function makeStyles(colors: ColorTokens) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    flex: {
      flex: 1,
    },
    topBar: {
      paddingHorizontal: 20,
    },
    back: {
      alignSelf: 'flex-start',
      paddingHorizontal: 12,
      paddingVertical: 7,
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
    localBanner: {
      marginTop: 18,
      marginHorizontal: 20,
      padding: 12,
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
    sectionRow: {
      marginTop: 28,
      marginBottom: 8,
      paddingHorizontal: 20,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    section: {
      fontFamily: fonts.displaySemi,
      fontSize: 12,
      letterSpacing: 2.2,
      color: colors.gold,
      flex: 1,
    },
    sort: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: colors.accent2,
      backgroundColor: colors.accent2Soft,
    },
    sortText: {
      fontFamily: fonts.displaySemi,
      fontSize: 12,
      letterSpacing: 0.8,
      color: colors.accent2,
    },
    markHint: {
      paddingHorizontal: 20,
      marginBottom: 12,
      fontFamily: fonts.sans,
      fontSize: 12,
      color: colors.textMuted,
    },
    center: {
      paddingVertical: 24,
      paddingHorizontal: 20,
      gap: 10,
    },
    empty: {
      paddingHorizontal: 20,
      fontFamily: fonts.sans,
      color: colors.textMuted,
      lineHeight: 22,
    },
    loadMoreHint: {
      paddingVertical: 20,
      alignItems: 'center',
      gap: 8,
    },
    loadMoreText: {
      fontFamily: fonts.sans,
      fontSize: 12,
      color: colors.textMuted,
    },
    rowWrap: {
      paddingHorizontal: 20,
      marginBottom: 10,
      flexDirection: 'row',
      alignItems: 'stretch',
      gap: 8,
    },
    row: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 12,
    },
    rowRead: {
      borderColor: colors.accent,
      backgroundColor: colors.accentSoft,
    },
    rowExternal: {
      borderColor: colors.gold,
      borderStyle: 'dashed',
    },
    pressed: {
      opacity: 0.86,
    },
    badge: {
      minWidth: 42,
      height: 42,
      paddingHorizontal: 6,
      backgroundColor: colors.surface2,
      borderWidth: 1,
      borderColor: colors.accent2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeExternal: {
      borderColor: colors.gold,
    },
    badgeText: {
      fontFamily: fonts.display,
      color: colors.accent2,
      fontSize: 11,
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
    mark: {
      width: 72,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    markOn: {
      borderColor: colors.accent,
      backgroundColor: colors.accentSoft,
    },
    markText: {
      fontFamily: fonts.displaySemi,
      fontSize: 10,
      letterSpacing: 0.6,
      color: colors.textMuted,
    },
    markTextOn: {
      color: colors.accent,
    },
  });
}
