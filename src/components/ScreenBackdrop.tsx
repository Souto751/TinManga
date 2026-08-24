import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { useApp } from '../context/AppContext';

export function ScreenBackdrop() {
  const { colors, config } = useApp();
  const light = config.colorScheme === 'light';

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={
          light
            ? ['#E8D4E4', colors.bg, '#D3E6EA']
            : ['#2A1024', colors.bg, '#06141C']
        }
        locations={[0, 0.42, 1]}
        start={{ x: 0.05, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[
          styles.magenta,
          { backgroundColor: light ? 'rgba(255, 46, 138, 0.1)' : 'rgba(255, 46, 138, 0.16)' },
        ]}
      />
      <View
        style={[
          styles.cyan,
          { backgroundColor: light ? 'rgba(10, 155, 176, 0.1)' : 'rgba(62, 240, 255, 0.1)' },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  magenta: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 220,
    top: -70,
    right: -50,
  },
  cyan: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 260,
    bottom: 40,
    left: -90,
  },
});
