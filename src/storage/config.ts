import { Directory, File, Paths } from 'expo-file-system';

import { AppConfig } from '../types';
import { seedTracking } from '../tracking/ids';

const defaultConfig = (): AppConfig => ({
  libraryUri: null,
  libraryName: null,
  coversFolderUri: null,
  coversFolderName: null,
  readingDirection: 'rtl',
  colorScheme: 'dark',
  keepScreenOn: true,
  onlineMode: true,
  progress: {},
  seriesCovers: {},
  tracking: {},
  updateDismissedVersionCode: null,
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
    const progress = parsed.progress ?? {};
    const next: AppConfig = {
      ...defaultConfig(),
      ...parsed,
      colorScheme: parsed.colorScheme === 'light' ? 'light' : 'dark',
      progress,
      seriesCovers: parsed.seriesCovers ?? {},
      tracking: parsed.tracking ?? seedTracking(progress),
      onlineMode: parsed.onlineMode ?? true,
      updateDismissedVersionCode: parsed.updateDismissedVersionCode ?? null,
    };
    if (!parsed.tracking) {
      await saveConfig(next);
    }
    return next;
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
