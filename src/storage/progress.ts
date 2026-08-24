import { ComicProgress } from '../types';

export function isProgressComplete(progress?: ComicProgress): boolean {
  if (!progress) {
    return false;
  }
  if (progress.completed) {
    return true;
  }
  return progress.total > 0 && progress.page >= progress.total - 1;
}
