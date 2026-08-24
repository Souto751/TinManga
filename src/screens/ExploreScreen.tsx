import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CoverCard } from '../components/CoverCard';
import { ScreenBackdrop } from '../components/ScreenBackdrop';
import { useApp } from '../context/AppContext';
import { RootStackParamList } from '../navigation/types';
import { searchManga } from '../online/mangadex/api';
import { RemoteManga } from '../online/mangadex/types';
import { ColorTokens, fonts } from '../theme';

export function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors } = useApp();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [results, setResults] = useState<RemoteManga[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 450);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void searchManga(debounced)
      .then((items) => {
        if (!cancelled) {
          setResults(items);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'No se pudo hablar con MangaDex.');
          setResults([]);
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
  }, [debounced]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScreenBackdrop />
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>VOLVER</Text>
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.kicker}>MANGADEX</Text>
          <Text style={styles.title}>EXPLORAR</Text>
        </View>
      </View>
      <Text style={styles.hint}>Solo lectura online. Lo descargado sigue siendo tu carpeta CBR.</Text>
      <View style={styles.search}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar manga…"
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
          autoCorrect={false}
          autoCapitalize="none"
        />
      </View>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent2} />
          <Text style={styles.loadingText}>{debounced ? 'Buscando…' : 'Cargando catálogo…'}</Text>
        </View>
      ) : error ? (
        <Text style={styles.empty}>{error}</Text>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<Text style={styles.empty}>No hay resultados en español para esa búsqueda.</Text>}
          renderItem={({ item }) => (
            <View style={styles.cell}>
              <CoverCard
                id={item.id}
                title={item.title}
                subtitle={item.year ? String(item.year) : item.status || 'MangaDex'}
                coverUri={item.coverUri}
                onPress={() => navigation.navigate('RemoteManga', { mangaId: item.id, preview: item })}
              />
            </View>
          )}
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
    header: {
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
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
    headerText: {
      flex: 1,
    },
    kicker: {
      fontFamily: fonts.displaySemi,
      fontSize: 11,
      letterSpacing: 2.4,
      color: colors.accent2,
    },
    title: {
      fontFamily: fonts.display,
      fontSize: 26,
      color: colors.text,
    },
    hint: {
      paddingHorizontal: 20,
      marginBottom: 10,
      fontFamily: fonts.sans,
      fontSize: 13,
      color: colors.textMuted,
    },
    search: {
      paddingHorizontal: 20,
      marginBottom: 12,
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
    row: {
      gap: 14,
      marginBottom: 18,
    },
    cell: {
      flex: 1,
      maxWidth: '50%',
    },
    center: {
      paddingTop: 40,
      alignItems: 'center',
      gap: 10,
    },
    loadingText: {
      fontFamily: fonts.sans,
      color: colors.textMuted,
    },
    empty: {
      paddingHorizontal: 20,
      fontFamily: fonts.sans,
      color: colors.textMuted,
      lineHeight: 22,
    },
  });
}
