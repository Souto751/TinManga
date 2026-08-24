import { useNavigation } from '@react-navigation/native';
import { useMemo } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { clearPageCache } from '../archive/cache';
import { ScreenBackdrop } from '../components/ScreenBackdrop';
import { useApp } from '../context/AppContext';
import { friendlyFolderName } from '../library/scan';
import { ColorTokens, fonts } from '../theme';

export function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { config, colors, pickFolder, pickCoversFolder, setReadingDirection, setColorScheme, setKeepScreenOn } = useApp();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const clearCache = () => {
    Alert.alert(
      'Limpiar caché',
      'Se borran las páginas extraídas. Los archivos originales y el progreso no se tocan.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Limpiar',
          onPress: () => {
            void clearPageCache();
          },
        },
      ],
    );
  };

  return (
    <View style={styles.screen}>
      <ScreenBackdrop />
    <ScrollView
      style={{ paddingTop: insets.top + 8 }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 24, paddingHorizontal: 20, flexGrow: 1 }}
    >
      <View style={styles.top}>
        <Pressable onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>VOLVER</Text>
        </Pressable>
        <Text style={styles.kicker}>CONFIG</Text>
        <Text style={styles.title}>AJUSTES</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Carpeta de mangas</Text>
        <Text style={styles.value} numberOfLines={2}>
          {config.libraryName ? friendlyFolderName(config.libraryName, config.libraryName) : 'Sin carpeta'}
        </Text>
        <Pressable onPress={() => void pickFolder()} style={styles.button}>
          <Text style={styles.buttonText}>Cambiar carpeta</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Carpeta de tapas</Text>
        <Text style={styles.value} numberOfLines={2}>
          {config.coversFolderName ? friendlyFolderName(config.coversFolderName, config.coversFolderName) : 'Sin carpeta'}
        </Text>
        <Text style={styles.hint}>
          Imágenes con el nombre de la serie, por ejemplo Pandora Hearts.jpg. También podés asignar una tapa
          a mano manteniendo presionada la serie.
        </Text>
        <Pressable onPress={() => void pickCoversFolder()} style={styles.button}>
          <Text style={styles.buttonText}>{config.coversFolderUri ? 'Cambiar carpeta' : 'Elegir carpeta'}</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Dirección de lectura</Text>
        <View style={styles.segment}>
          <Pressable
            onPress={() => void setReadingDirection('rtl')}
            style={[styles.segmentItem, config.readingDirection === 'rtl' && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, config.readingDirection === 'rtl' && styles.segmentTextActive]}>
              Manga
            </Text>
            <Text style={styles.segmentHint}>derecha → izquierda</Text>
          </Pressable>
          <Pressable
            onPress={() => void setReadingDirection('ltr')}
            style={[styles.segmentItem, config.readingDirection === 'ltr' && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, config.readingDirection === 'ltr' && styles.segmentTextActive]}>
              Cómic
            </Text>
            <Text style={styles.segmentHint}>izquierda → derecha</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Apariencia</Text>
        <View style={styles.segment}>
          <Pressable
            onPress={() => void setColorScheme('dark')}
            style={[styles.segmentItem, config.colorScheme !== 'light' && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, config.colorScheme !== 'light' && styles.segmentTextActive]}>
              Oscuro
            </Text>
            <Text style={styles.segmentHint}>tinta</Text>
          </Pressable>
          <Pressable
            onPress={() => void setColorScheme('light')}
            style={[styles.segmentItem, config.colorScheme === 'light' && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, config.colorScheme === 'light' && styles.segmentTextActive]}>
              Claro
            </Text>
            <Text style={styles.segmentHint}>papel</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.rowCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Pantalla encendida</Text>
          <Text style={styles.hint}>Evita que se apague mientras leés</Text>
        </View>
        <Switch
          value={config.keepScreenOn}
          onValueChange={(value) => void setKeepScreenOn(value)}
          trackColor={{ false: colors.border, true: colors.accent }}
          thumbColor={colors.gold}
        />
      </View>

      <Pressable onPress={clearCache} style={styles.ghost}>
        <Text style={styles.ghostText}>Limpiar caché de páginas</Text>
      </Pressable>

      <Text style={styles.footnote}>
        Uso personal. No hay cuenta, ni nube, ni base de datos. El progreso se guarda en lectorcbr.json
        dentro del almacenamiento de la app.
      </Text>
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
  top: {
    marginBottom: 24,
  },
  back: {
    alignSelf: 'flex-start',
    marginBottom: 12,
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
  kicker: {
    fontFamily: fonts.displaySemi,
    fontSize: 11,
    letterSpacing: 2.4,
    color: colors.accent2,
    marginBottom: 4,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 32,
    color: colors.text,
    letterSpacing: 1.2,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 14,
  },
  rowCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  label: {
    fontFamily: fonts.displaySemi,
    fontSize: 11,
    color: colors.accent2,
    letterSpacing: 1.6,
  },
  value: {
    marginTop: 8,
    fontFamily: fonts.sansSemi,
    fontSize: 16,
    color: colors.text,
  },
  hint: {
    marginTop: 6,
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textMuted,
  },
  button: {
    marginTop: 14,
    alignSelf: 'flex-start',
    backgroundColor: colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  buttonText: {
    fontFamily: fonts.displaySemi,
    color: colors.text,
    fontSize: 12,
    letterSpacing: 1,
  },
  segment: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  segmentItem: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
    padding: 12,
  },
  segmentActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  segmentText: {
    fontFamily: fonts.displaySemi,
    color: colors.textMuted,
    fontSize: 15,
  },
  segmentTextActive: {
    color: colors.text,
  },
  segmentHint: {
    marginTop: 4,
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.textMuted,
  },
  ghost: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  ghostText: {
    fontFamily: fonts.sansMedium,
    color: colors.gold,
    fontSize: 14,
  },
  footnote: {
    marginTop: 'auto',
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textMuted,
  },
  });
}
