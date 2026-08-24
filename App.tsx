import { ChakraPetch_600SemiBold, ChakraPetch_700Bold } from '@expo-google-fonts/chakra-petch';
import { DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import { useFonts } from 'expo-font';
import * as SystemUI from 'expo-system-ui';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppProvider, useApp } from './src/context/AppContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { colors as darkColors } from './src/theme';

function Gate() {
  const { ready, colors, config } = useApp();

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.bg);
  }, [colors.bg]);

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg }]}>
      <StatusBar style={config.colorScheme === 'light' ? 'dark' : 'light'} />
      {ready ? (
        <RootNavigator />
      ) : (
        <View style={styles.boot}>
          <ActivityIndicator color={colors.accent2} />
        </View>
      )}
    </View>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    ChakraPetch_600SemiBold,
    ChakraPetch_700Bold,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
  });

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(darkColors.bg);
  }, []);

  if (!fontsLoaded) {
    return (
      <View style={[styles.boot, { backgroundColor: darkColors.bg }]}>
        <ActivityIndicator color={darkColors.accent2} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={[styles.flex, { backgroundColor: darkColors.bg }]}>
      <SafeAreaProvider>
        <AppProvider>
          <Gate />
        </AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  boot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
