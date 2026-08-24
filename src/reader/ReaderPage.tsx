import { Image } from 'expo-image';
import { memo } from 'react';
import { Pressable } from 'react-native';

import { MANGADEX_USER_AGENT } from '../online/mangadex/constants';

type Props = {
  uri: string;
  width: number;
  height: number;
  remote: boolean;
  onTap: (x: number) => void;
};

export const ReaderPage = memo(function ReaderPage({ uri, width, height, remote, onTap }: Props) {
  return (
    <Pressable
      style={{ width, height, backgroundColor: '#000' }}
      onPress={(event) => onTap(event.nativeEvent.locationX)}
    >
      <Image
        source={
          remote
            ? { uri, headers: { 'User-Agent': MANGADEX_USER_AGENT } }
            : { uri }
        }
        style={{ width, height }}
        contentFit="contain"
        cachePolicy="memory-disk"
        priority="high"
        recyclingKey={uri}
        transition={0}
        allowDownscaling
      />
    </Pressable>
  );
});
