import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useApp } from '../context/AppContext';
import { ColorTokens, fonts } from '../theme';
import { HudCorners } from './HudCorners';

type Props = {
  onPickFolder: () => void;
  onExplore?: () => void;
};

export function EmptyLibrary({ onPickFolder, onExplore }: Props) {
  const { colors } = useApp();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.wrap}>
      <HudCorners style={styles.frame} color={colors.accent2}>
        <Text style={styles.mark}>CBR</Text>
        <Text style={styles.title}>ELEGÍ TU BIBLIOTECA</Text>
        <Text style={styles.copy}>
          Seleccioná la carpeta donde tenés los mangas. El catálogo se arma solo y el progreso queda
          guardado en un archivo local.
        </Text>
        <Pressable onPress={onPickFolder} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
          <Text style={styles.buttonLabel}>ELEGIR CARPETA</Text>
        </Pressable>
        {onExplore ? (
          <Pressable onPress={onExplore} style={({ pressed }) => [styles.ghost, pressed && styles.pressed]}>
            <Text style={styles.ghostLabel}>EXPLORAR MANGADEX</Text>
          </Pressable>
        ) : null}
      </HudCorners>
    </View>
  );
}

function makeStyles(colors: ColorTokens) {
  return StyleSheet.create({
    wrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 28,
    },
    frame: {
      width: '100%',
      paddingHorizontal: 24,
      paddingVertical: 32,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      alignItems: 'center',
    },
    mark: {
      fontFamily: fonts.display,
      fontSize: 56,
      color: colors.accent,
      marginBottom: 8,
      letterSpacing: 4,
    },
    title: {
      fontFamily: fonts.displaySemi,
      fontSize: 20,
      color: colors.text,
      textAlign: 'center',
      letterSpacing: 1,
    },
    copy: {
      marginTop: 12,
      fontFamily: fonts.sans,
      fontSize: 15,
      lineHeight: 22,
      color: colors.textMuted,
      textAlign: 'center',
    },
    button: {
      marginTop: 28,
      backgroundColor: colors.accent,
      paddingHorizontal: 22,
      paddingVertical: 14,
      borderRadius: 8,
    },
    pressed: {
      opacity: 0.88,
    },
    buttonLabel: {
      fontFamily: fonts.displaySemi,
      color: '#F4F1FF',
      fontSize: 14,
      letterSpacing: 1.2,
    },
    ghost: {
      marginTop: 12,
      paddingHorizontal: 22,
      paddingVertical: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.accent2,
    },
    ghostLabel: {
      fontFamily: fonts.displaySemi,
      color: colors.accent2,
      fontSize: 13,
      letterSpacing: 1.2,
    },
  });
}
