import { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp } from '../context/AppContext';
import { ColorTokens, fonts, radius } from '../theme';

export function UpdateBanner() {
  const insets = useSafeAreaInsets();
  const { colors, updateInfo, updateState, updateError, installAvailableUpdate, dismissUpdate } = useApp();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const visible =
    Boolean(updateInfo) &&
    (updateState === 'available' || updateState === 'downloading' || updateState === 'installing' || updateState === 'error');

  if (!visible || !updateInfo) {
    return null;
  }

  const busy = updateState === 'downloading' || updateState === 'installing';

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { top: insets.top + 8 }]}>
      <View style={styles.card}>
        <View style={styles.body}>
          <Text style={styles.title}>Nueva versión disponible</Text>
          <Text style={styles.meta} numberOfLines={2}>
            {updateState === 'error'
              ? updateError ?? 'No se pudo actualizar.'
              : updateState === 'downloading'
                ? 'Descargando…'
                : updateState === 'installing'
                  ? 'Abriendo instalador…'
                  : `v${updateInfo.version} lista para instalar`}
          </Text>
        </View>
        {busy ? (
          <ActivityIndicator color={colors.accent2} style={styles.spinner} />
        ) : (
          <Pressable onPress={() => void installAvailableUpdate()} style={styles.button}>
            <Text style={styles.buttonText}>{updateState === 'error' ? 'Reintentar' : 'Actualizar'}</Text>
          </Pressable>
        )}
        {!busy ? (
          <Pressable onPress={() => void dismissUpdate()} hitSlop={10} style={styles.close}>
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function makeStyles(colors: ColorTokens) {
  return StyleSheet.create({
    wrap: {
      position: 'absolute',
      left: 16,
      right: 16,
      zIndex: 50,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.accent2,
      borderRadius: radius.md,
      paddingVertical: 10,
      paddingHorizontal: 14,
      shadowColor: '#000',
      shadowOpacity: 0.3,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
    },
    body: {
      flex: 1,
    },
    title: {
      fontFamily: fonts.displaySemi,
      fontSize: 13,
      color: colors.text,
      letterSpacing: 0.4,
    },
    meta: {
      marginTop: 2,
      fontFamily: fonts.sans,
      fontSize: 12,
      color: colors.textMuted,
    },
    button: {
      backgroundColor: colors.accent,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
    },
    buttonText: {
      fontFamily: fonts.displaySemi,
      color: colors.text,
      fontSize: 12,
      letterSpacing: 0.6,
    },
    spinner: {
      marginHorizontal: 6,
    },
    close: {
      paddingHorizontal: 4,
    },
    closeText: {
      color: colors.textMuted,
      fontSize: 14,
    },
  });
}
