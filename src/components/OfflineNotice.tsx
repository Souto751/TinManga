import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useApp } from '../context/AppContext';
import { ColorTokens, fonts } from '../theme';
import { HudCorners } from './HudCorners';

export function OfflineNotice() {
  const { colors, setOnlineMode } = useApp();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.wrap}>
      <HudCorners style={styles.frame} color={colors.accent2}>
        <Text style={styles.title}>MODO OFFLINE</Text>
        <Text style={styles.copy}>
          Explorar necesita conexión a MangaDex. Activá el modo online en Ajustes (o acá abajo) para
          buscar y leer online — tu biblioteca local sigue disponible igual.
        </Text>
        <Pressable
          onPress={() => void setOnlineMode(true)}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        >
          <Text style={styles.buttonLabel}>ACTIVAR MODO ONLINE</Text>
        </Pressable>
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
      borderRadius: 0,
      alignItems: 'center',
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
      borderRadius: 0,
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
  });
}
