import { requireNativeModule } from 'expo';

type NativeUnrarModule = {
  extractImages(archivePath: string, outputPath: string): Promise<number>;
};

export default requireNativeModule<NativeUnrarModule>('NativeUnrar');
