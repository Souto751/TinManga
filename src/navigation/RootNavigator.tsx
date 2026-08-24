import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useMemo } from 'react';

import { useApp } from '../context/AppContext';
import { ExploreScreen } from '../screens/ExploreScreen';
import { LibraryScreen } from '../screens/LibraryScreen';
import { ReaderScreen } from '../screens/ReaderScreen';
import { RemoteMangaScreen } from '../screens/RemoteMangaScreen';
import { SeriesScreen } from '../screens/SeriesScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { colors, config } = useApp();
  const theme = useMemo(
    () => ({
      ...(config.colorScheme === 'light' ? DefaultTheme : DarkTheme),
      colors: {
        ...(config.colorScheme === 'light' ? DefaultTheme.colors : DarkTheme.colors),
        background: colors.bg,
        card: colors.surface,
        text: colors.text,
        border: colors.border,
        primary: colors.accent,
      },
    }),
    [colors, config.colorScheme],
  );

  return (
    <NavigationContainer theme={theme}>
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Stack.Screen name="Library" component={LibraryScreen} />
        <Stack.Screen name="Explore" component={ExploreScreen} />
        <Stack.Screen name="RemoteManga" component={RemoteMangaScreen} />
        <Stack.Screen name="Series" component={SeriesScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen
          name="Reader"
          component={ReaderScreen}
          options={{ animation: 'fade', gestureEnabled: true, statusBarHidden: true }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
