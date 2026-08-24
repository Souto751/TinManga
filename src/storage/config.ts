import { Directory, File, Paths } from 'expo-file-system';

import { AppConfig } from '../types';

const defaultConfig = (): AppConfig => ({
  libraryUri: null,
  libraryName: null,
  coversFolderUri: null,
  coversFolderName: null,
  readingDirection: 'rtl',
  colorScheme: 'dark',
  keepScreenOn: true,
  progress: {},
  seriesCovers: {},
});

function configFile(): File {
  const dir = new Directory(Paths.document);
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }
  return new File(dir, 'lectorcbr.json');
}

export async function loadConfig(): Promise<AppConfig> {
  const file = configFile();
  if (!file.exists) {
    const initial = defaultConfig();
    await saveConfig(initial);
    return initial;
  }

  try {
    const parsed = JSON.parse(await file.text()) as Partial<AppConfig>;
    return {
      ...defaultConfig(),
      ...parsed,
      colorScheme: parsed.colorScheme === 'light' ? 'light' : 'dark',
      progress: parsed.progress ?? {},
      seriesCovers: parsed.seriesCovers ?? {},
    };
  } catch {
    return defaultConfig();
  }
}

export async function saveConfig(config: AppConfig): Promise<void> {
  const file = configFile();
  if (!file.exists) {
    file.create({ intermediates: true, overwrite: true });
  }
  file.write(JSON.stringify(config, null, 2));
}

export function configPath(): string {
  return configFile().uri;
}
