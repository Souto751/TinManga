import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useApp } from '../context/AppContext';
import { ColorTokens, fonts } from '../theme';
import { TRACKING_LABELS } from '../tracking/ids';
import { TrackingStatus } from '../types';

type Props = {
  value?: TrackingStatus;
  onChange: (status: TrackingStatus) => void;
};

const ORDER: TrackingStatus[] = ['plan', 'reading', 'read'];

export function StatusChips({ value, onChange }: Props) {
  const { colors } = useApp();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.row}>
      {ORDER.map((status) => {
        const active = value === status;
        return (
          <Pressable
            key={status}
            onPress={() => onChange(status)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{TRACKING_LABELS[status]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function makeStyles(colors: ColorTokens) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      gap: 8,
    },
    chip: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 8,
      paddingHorizontal: 4,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface2,
    },
    chipActive: {
      borderColor: colors.accent,
      backgroundColor: colors.accentSoft,
    },
    label: {
      fontFamily: fonts.displaySemi,
      fontSize: 11,
      letterSpacing: 0.4,
      color: colors.textMuted,
    },
    labelActive: {
      color: colors.text,
    },
  });
}
