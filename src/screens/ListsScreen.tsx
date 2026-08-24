import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CoverCard } from '../components/CoverCard';
import { ScreenBackdrop } from '../components/ScreenBackdrop';
import { useApp } from '../context/AppContext';
import { RootStackParamList } from '../navigation/types';
import { ColorTokens, fonts } from '../theme';
import { TRACKING_LABELS } from '../tracking/ids';
import { TrackedTitle, TrackingStatus } from '../types';

const FILTERS: Array<{ id: TrackingStatus; label: string }> = [
  { id: 'reading', label: 'LEYENDO' },
  { id: 'plan', label: 'POR LEER' },
  { id: 'read', label: 'LEÍDO' },
];

export function ListsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { config, colors, series, coverForSeries, removeTracking, upsertTracking } = useApp();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [filter, setFilter] = useState<TrackingStatus>('reading');

  const items = useMemo(() => {
    return Object.values(config.tracking)
      .filter((entry) => entry.status === filter)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [config.tracking, filter]);

  const counts = useMemo(() => {
    const next = { plan: 0, reading: 0, read: 0 };
    for (const entry of Object.values(config.tracking)) {
      next[entry.status] += 1;
    }
    return next;
  }, [config.tracking]);

  const coverFor = (entry: TrackedTitle) => {
    if (entry.source === 'local' && entry.localSeriesId) {
      const local = series.find((item) => item.id === entry.localSeriesId);
      if (local) {
        return coverForSeries(local) ?? entry.coverUri;
      }
    }
    return entry.coverUri;
  };

  const openEntry = (entry: TrackedTitle) => {
    if (entry.source === 'mangadex' && entry.mangaId) {
      navigation.navigate('RemoteManga', { mangaId: entry.mangaId });
      return;
    }
    if (entry.localSeriesId) {
      navigation.navigate('Series', { seriesId: entry.localSeriesId });
    }
  };

  const editEntry = (entry: TrackedTitle) => {
    Alert.alert(entry.title, 'Cambiar el estado de este título.', [
      {
        text: 'Por leer',
        onPress: () => {
          void upsertTracking({ ...entry, status: 'plan' });
        },
      },
      {
        text: 'Leyendo',
        onPress: () => {
          void upsertTracking({ ...entry, status: 'reading' });
        },
      },
      {
        text: 'Leído',
        onPress: () => {
          void upsertTracking({ ...entry, status: 'read' });
        },
      },
      {
        text: 'Quitar de la lista',
        style: 'destructive',
        onPress: () => {
          void removeTracking(entry.id);
        },
      },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  const confirmRemove = (entry: TrackedTitle) => {
    Alert.alert(entry.title, '¿Lo sacás de la lista? El progreso de lectura no se borra.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Quitar',
        style: 'destructive',
        onPress: () => {
          void removeTracking(entry.id);
        },
      },
    ]);
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScreenBackdrop />
      <View style={styles.header}>
        <Text style={styles.kicker}>SEGUIMIENTO LOCAL</Text>
        <Text style={styles.title}>LISTA</Text>
      </View>
      <Text style={styles.hint}>
        Por leer, leyendo y leído. Tocá la tapa para abrir; QUITAR lo saca de la lista.
      </Text>
      <View style={styles.filters}>
        {FILTERS.map((item) => {
          const active = filter === item.id;
          return (
            <Pressable
              key={item.id}
              onPress={() => setFilter(item.id)}
              style={[styles.filter, active && styles.filterActive]}
            >
              <Text style={[styles.filterLabel, active && styles.filterLabelActive]}>
                {item.label}
                {counts[item.id] ? `  ${counts[item.id]}` : ''}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {filter === 'plan'
              ? 'Nada por leer todavía. En Explorar o en una ficha podés marcarlo.'
              : filter === 'reading'
                ? 'Cuando abras un tomo o un capítulo, aparece acá.'
                : 'Marcá un título como leído desde su ficha o manteniendo presionada la tapa.'}
          </Text>
        }
        renderItem={({ item }) => (
          <View style={styles.cell}>
            <CoverCard
              id={item.id}
              title={item.title}
              subtitle={item.source === 'mangadex' ? 'MangaDex' : TRACKING_LABELS[item.status]}
              coverUri={coverFor(item)}
              onPress={() => openEntry(item)}
              onLongPress={() => editEntry(item)}
            />
            <Pressable onPress={() => confirmRemove(item)} style={styles.remove}>
              <Text style={styles.removeText}>QUITAR</Text>
            </Pressable>
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
      paddingBottom: 8,
    },
    kicker: {
      fontFamily: fonts.displaySemi,
      fontSize: 11,
      letterSpacing: 2.4,
      color: colors.accent2,
    },
    title: {
      fontFamily: fonts.display,
      fontSize: 28,
      color: colors.text,
    },
    hint: {
      paddingHorizontal: 20,
      marginBottom: 12,
      fontFamily: fonts.sans,
      fontSize: 13,
      color: colors.textMuted,
    },
    filters: {
      flexDirection: 'row',
      marginHorizontal: 20,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    filter: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 10,
      backgroundColor: colors.surface,
    },
    filterActive: {
      backgroundColor: colors.accentSoft,
    },
    filterLabel: {
      fontFamily: fonts.displaySemi,
      fontSize: 11,
      letterSpacing: 0.6,
      color: colors.textMuted,
    },
    filterLabelActive: {
      color: colors.accent,
    },
    list: {
      paddingHorizontal: 20,
      paddingBottom: 24,
    },
    row: {
      gap: 14,
      marginBottom: 18,
    },
    cell: {
      flex: 1,
      maxWidth: '50%',
    },
    remove: {
      marginTop: 8,
      alignItems: 'center',
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: colors.accent,
      backgroundColor: colors.accentSoft,
    },
    removeText: {
      fontFamily: fonts.displaySemi,
      fontSize: 11,
      letterSpacing: 1.2,
      color: colors.accent,
    },
    empty: {
      fontFamily: fonts.sans,
      color: colors.textMuted,
      lineHeight: 22,
      paddingVertical: 24,
    },
  });
}
