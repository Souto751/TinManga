import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { ExploreScreen } from '../screens/ExploreScreen';
import { LibraryScreen } from '../screens/LibraryScreen';
import { ListsScreen } from '../screens/ListsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { AppTabBar } from './AppTabBar';
import { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

export function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <AppTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Library" component={LibraryScreen} />
      <Tab.Screen name="Lists" component={ListsScreen} />
      <Tab.Screen name="Explore" component={ExploreScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}
