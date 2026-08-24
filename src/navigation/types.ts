import { NavigatorScreenParams } from '@react-navigation/native';

import { RemoteManga } from '../online/mangadex/types';
import { Comic } from '../types';

export type MainTabParamList = {
  Library: undefined;
  Lists: undefined;
  Explore: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
  Series: { seriesId: string };
  Reader: { comic: Comic };
  RemoteManga: { mangaId: string; preview?: RemoteManga };
};
