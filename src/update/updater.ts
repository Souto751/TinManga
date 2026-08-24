import Constants from 'expo-constants';
import { Directory, File, Paths } from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';

/**
 * Chequeo de actualizaciones vía GitHub Releases.
 *
 * Cómo funciona:
 * 1. La app pide el último release de `REPO` a la API pública de GitHub.
 * 2. Ese release tiene que traer dos assets: un .apk y un `latest.json`
 *    ({ version, versionCode, notes }). Los publica el workflow de
 *    .github/workflows/release.yml cada vez que se pushea un tag vX.Y.Z.
 * 3. Si el versionCode del release es mayor al de esta build (leído del
 *    manifest embebido con expo-constants), hay actualización disponible.
 * 4. Descarga el .apk a caché y abre el instalador de Android
 *    (ACTION_INSTALL_PACKAGE) — el usuario igual tiene que tocar "Instalar",
 *    Android no permite instalar apps fuera de Play Store en silencio.
 */

const REPO = 'Souto751/TinManga';
const RELEASES_LATEST_URL = `https://api.github.com/repos/${REPO}/releases/latest`;

export type UpdateInfo = {
  version: string;
  versionCode: number;
  notes: string;
  apkUrl: string;
  htmlUrl: string;
};

export type UpdateCheckResult =
  | { status: 'up-to-date' }
  | { status: 'available'; info: UpdateInfo }
  | { status: 'error'; message: string };

type GithubAsset = {
  name: string;
  browser_download_url: string;
};

type GithubRelease = {
  html_url: string;
  assets: GithubAsset[];
};

type LatestMeta = {
  version: string;
  versionCode: number;
  notes?: string;
};

export function currentVersionCode(): number {
  const raw = Constants.expoConfig?.android?.versionCode;
  return typeof raw === 'number' ? raw : 0;
}

export function currentVersionName(): string {
  return Constants.expoConfig?.version ?? '0.0.0';
}

export async function checkForUpdate(): Promise<UpdateCheckResult> {
  let release: GithubRelease;
  try {
    const res = await fetch(RELEASES_LATEST_URL, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'TinMangas-updater',
      },
    });
    if (!res.ok) {
      return { status: 'error', message: `GitHub respondió ${res.status}.` };
    }
    release = (await res.json()) as GithubRelease;
  } catch (err) {
    return { status: 'error', message: err instanceof Error ? err.message : 'Sin conexión.' };
  }

  const apkAsset = release.assets?.find((asset) => asset.name.toLowerCase().endsWith('.apk'));
  const metaAsset = release.assets?.find((asset) => asset.name.toLowerCase() === 'latest.json');
  if (!apkAsset || !metaAsset) {
    return { status: 'error', message: 'El último release no tiene APK o latest.json.' };
  }

  let meta: LatestMeta;
  try {
    const metaRes = await fetch(metaAsset.browser_download_url);
    if (!metaRes.ok) {
      return { status: 'error', message: 'No se pudo leer la info de versión del release.' };
    }
    meta = (await metaRes.json()) as LatestMeta;
  } catch (err) {
    return { status: 'error', message: err instanceof Error ? err.message : 'No se pudo leer latest.json.' };
  }

  if (!meta.versionCode || meta.versionCode <= currentVersionCode()) {
    return { status: 'up-to-date' };
  }

  return {
    status: 'available',
    info: {
      version: meta.version,
      versionCode: meta.versionCode,
      notes: meta.notes ?? '',
      apkUrl: apkAsset.browser_download_url,
      htmlUrl: release.html_url,
    },
  };
}

export async function downloadUpdate(info: UpdateInfo): Promise<File> {
  const dir = new Directory(Paths.cache, 'updates');
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }
  // Nombre fijo: cada descarga nueva pisa la anterior, así no se acumulan
  // APKs viejos en caché.
  const destination = new File(dir, 'TinMangas-update.apk');
  if (destination.exists) {
    try {
      destination.delete();
    } catch {
      // no-op: si no se puede borrar seguimos igual, downloadFileAsync la pisa
    }
  }
  return File.downloadFileAsync(info.apkUrl, destination);
}

export async function installUpdate(file: File): Promise<void> {
  const contentUri = file.contentUri;
  await IntentLauncher.startActivityAsync('android.intent.action.INSTALL_PACKAGE', {
    data: contentUri,
    flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
  });
}
