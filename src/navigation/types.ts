import { Comic } from '../types';

export type RootStackParamList = {
  Library: undefined;
  Series: { seriesId: string };
  Reader: { comic: Comic };
  Settings: undefined;
};
