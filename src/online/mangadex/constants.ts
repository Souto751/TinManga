import { ApiLanguage } from '../../types';

export const MANGADEX_CLIENT_ID =
  'personal-client-7a41758b-1594-47b4-825a-f45e48c1e61a-218e19d1';

export const MANGADEX_USER_AGENT = `TinMangas/1.0 (personal; ${MANGADEX_CLIENT_ID})`;
export const MANGADEX_API = 'https://api.mangadex.org';
export const MANGADEX_COVERS = 'https://uploads.mangadex.org/covers';

export const API_LANGUAGES: ApiLanguage[] = ['es', 'es-la', 'en'];

export const API_LANGUAGE_LABELS: Record<ApiLanguage, string> = {
  es: 'Español',
  'es-la': 'Español latino',
  en: 'Inglés',
};

export const CHAPTER_PREFIX = 'md://chapter/';

export function remoteChapterId(uri: string): string | null {
  if (!uri.startsWith(CHAPTER_PREFIX)) {
    return null;
  }
  return uri.slice(CHAPTER_PREFIX.length);
}

export function isRemoteChapterUri(uri: string): boolean {
  return uri.startsWith(CHAPTER_PREFIX);
}
