import { RemoteManga } from '../online/mangadex/types';
import { Comic } from '../types';

export type RootStackParamList = {
  Library: undefined;
  Series: { seriesId: string };
  Reader: { comic: Comic };
  Settings: undefined;
  Explore: undefined;
  RemoteManga: { mangaId: string; preview?: RemoteManga };
};
