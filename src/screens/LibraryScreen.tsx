import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ContinueBanner } from '../components/ContinueBanner';
import { CoverCard } from '../components/CoverCard';
import { EmptyLibrary } from '../components/EmptyLibrary';
import { ScreenBackdrop } from '../components/ScreenBackdrop';
import { useApp } from '../context/AppContext';
import { RootStackParamList } from '../navigation/types';
import { ColorTokens, fonts } from '../theme';
import { Comic, ComicProgress, Series } from '../types';

function seriesSubtitle(item: Series, progress: Record<string, ComicProgress>): string {
  const count = item.volumes.length === 1 ? '1 tomo' : `${item.volumes.length} tomos`;
  const latest = item.volumes
    .map((volume) => progress[volume.id])
    .filter((entry): entry is ComicProgress => Boolean(entry))
    .sort((a, b) => b.updatedAt - a.updatedAt)[0];
  if (latest?.volumeLabel) {
    return `${count} · ${latest.volumeLabel}`;
  }
  return count;
}

function seriesRatio(item: Series, progress: Record<string, ComicProgress>): number {
  if (item.volumes.length === 0) {
    return 0;
  }
  const started = item.volumes.filter((volume) => progress[volume.id]).length;
  return started / item.volumes.length;
}

export function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {
    config,
    comics,
    series,
    scanning,
    pickFolder,
    refreshLibrary,
    continueReading,
    coverFor,
    coverForSeries,
    assignSeriesCover,
    clearSeriesCover,
    colors,
  } = useApp();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return series;
    }
    return series.filter((item) => item.name.toLowerCase().includes(needle));
  }, [series, query]);

  const openComic = (comic: Comic) => {
    navigation.navigate('Reader', { comic });
  };

  const openSeries = (item: Series) => {
    navigation.navigate('Series', { seriesId: item.id });
  };

  const openContinue = () => {
    if (!continueReading) {
      return;
    }
    const match = comics.find(
      (comic) => comic.uri === continueReading.uri || comic.id === continueReading.uri,
    );
    if (match) {
      openComic(match);
      return;
    }
    openComic({
      id: Object.entries(config.progress).find(([, value]) => value === continueReading)?.[0] ?? continueReading.uri,
      name: continueReading.name,
      filename: continueReading.name,
      uri: continueReading.uri,
      size: 0,
      extension: '',
      series: continueReading.series || continueReading.name,
      seriesId: continueReading.seriesId || '',
      seriesKey: '',
      volumeLabel: continueReading.volumeLabel || continueReading.name,
      displayName: continueReading.name,
    });
  };

  const seriesCoverActions = (item: Series) => {
    Alert.alert(item.name, 'Asigná una tapa desde el teléfono o desde la carpeta de imágenes.', [
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
    ].filter(Boolean) as { text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }[]);
  };

  if (!config.libraryUri) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <ScreenBackdrop />
        <EmptyLibrary onPickFolder={() => void pickFolder()} />
      </View>
    );
  }

  const continueSeries = continueReading?.seriesId
    ? series.find((item) => item.id === continueReading.seriesId)
    : undefined;
  const continueCover = continueSeries
    ? coverForSeries(continueSeries)
    : continueReading
      ? coverFor(
          Object.entries(config.progress).find(([, value]) => value === continueReading)?.[0] ?? '',
          continueReading.coverUri,
        )
      : undefined;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScreenBackdrop />
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.kicker} numberOfLines={1}>
            ARCHIVO PERSONAL
          </Text>
          <Text style={styles.wordmark} numberOfLines={1}>
            TINMANGAS
          </Text>
        </View>
        <Pressable onPress={() => navigation.navigate('Settings')} style={styles.iconButton}>
          <Text style={styles.iconButtonLabel}>AJUSTES</Text>
        </Pressable>
      </View>

      <View style={styles.search}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar serie…"
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={scanning}
            onRefresh={() => void refreshLibrary()}
            tintColor={colors.accent2}
          />
        }
        ListHeaderComponent={
          <View>
            {continueReading ? (
              <View style={styles.continue}>
                <ContinueBanner
                  item={continueReading}
                  coverUri={continueCover}
                  onPress={openContinue}
                />
              </View>
            ) : null}
            <Text style={styles.section}>
              SERIES{series.length ? `  ${filtered.length}` : ''}
            </Text>
            {scanning && series.length === 0 ? (
              <View style={styles.loading}>
                <ActivityIndicator color={colors.accent2} />
                <Text style={styles.loadingText}>Leyendo la carpeta…</Text>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          scanning ? null : (
            <View>
              <Text style={styles.empty}>
                No hay archivos .cbr o .cbz en esta carpeta. Tirando para abajo recargás el catálogo.
              </Text>
              <Pressable onPress={() => void pickFolder()} style={styles.emptyButton}>
                <Text style={styles.emptyButtonText}>Cambiar carpeta</Text>
              </Pressable>
            </View>
          )
        }
        renderItem={({ item }) => (
          <View style={styles.cell}>
            <CoverCard
              id={item.id}
              title={item.name}
              subtitle={seriesSubtitle(item, config.progress)}
              coverUri={coverForSeries(item)}
              progressRatio={seriesRatio(item, config.progress)}
              onPress={() => openSeries(item)}
              onLongPress={() => seriesCoverActions(item)}
            />
          </View>
        )}
      />
    </View>
  );
}

function makeStyles(colors: ColorTokens) {
  return StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  wordmark: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 32,
    color: colors.text,
    letterSpacing: 1,
  },
  kicker: {
    fontFamily: fonts.displaySemi,
    fontSize: 11,
    letterSpacing: 2.4,
    color: colors.accent2,
    marginBottom: 2,
  },
  iconButton: {
    flexShrink: 0,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  iconButtonLabel: {
    fontFamily: fonts.displaySemi,
    fontSize: 12,
    letterSpacing: 1,
    color: colors.text,
  },
  search: {
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  searchInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    color: colors.text,
    fontFamily: fonts.sans,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  continue: {
    marginBottom: 22,
    marginTop: 8,
  },
  section: {
    fontFamily: fonts.displaySemi,
    fontSize: 12,
    letterSpacing: 2.2,
    color: colors.gold,
    marginBottom: 14,
  },
  row: {
    gap: 14,
    marginBottom: 18,
  },
  cell: {
    flex: 1,
    maxWidth: '50%',
  },
  loading: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 10,
  },
  loadingText: {
    fontFamily: fonts.sans,
    color: colors.textMuted,
  },
  empty: {
    fontFamily: fonts.sans,
    color: colors.textMuted,
    lineHeight: 22,
    paddingVertical: 24,
  },
  emptyButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  emptyButtonText: {
    fontFamily: fonts.displaySemi,
    color: colors.text,
    fontSize: 12,
    letterSpacing: 1,
  },
  });
}
