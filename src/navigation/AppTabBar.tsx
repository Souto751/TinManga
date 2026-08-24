import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HudCorners } from '../components/HudCorners';
import { useApp } from '../context/AppContext';
import { ColorTokens, fonts } from '../theme';

const LABELS: Record<string, string> = {
  Library: 'ARCHIVO',
  Lists: 'LISTA',
  Explore: 'EXPLORAR',
  Settings: 'AJUSTES',
};

export function AppTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useApp();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <HudCorners
      color={colors.accent2}
      style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 8) }]}
    >
      <View style={styles.row}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          return (
            <Pressable
              key={route.key}
              onPress={() => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented) {
                  navigation.navigate(route.name);
                }
              }}
              style={[styles.item, focused && styles.itemActive]}
            >
              <Text style={[styles.label, focused && styles.labelActive]}>
                {LABELS[route.name] ?? route.name}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </HudCorners>
  );
}

function makeStyles(colors: ColorTokens) {
  return StyleSheet.create({
    wrap: {
      backgroundColor: colors.bg2,
      borderTopWidth: 1,
      borderColor: colors.border,
    },
    row: {
      flexDirection: 'row',
      minHeight: 52,
    },
    item: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
    },
    itemActive: {
      backgroundColor: colors.accentSoft,
    },
    label: {
      fontFamily: fonts.displaySemi,
      fontSize: 11,
      letterSpacing: 0.8,
      color: colors.textMuted,
    },
    labelActive: {
      color: colors.accent,
    },
  });
}
