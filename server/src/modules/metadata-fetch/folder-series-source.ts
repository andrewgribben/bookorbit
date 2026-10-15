import { dirname } from 'path';

import { deriveFolderSeries, type DerivedSeries } from '../scanner/lib/folder-series';

/**
 * Series name and index implied by a book's content file path under a library root.
 * Returns null when the file sits at the library root or the path cannot form a series.
 */
export function folderSeriesFromFilePath(absolutePath: string, libraryRoot: string): DerivedSeries | null {
  const trimmedPath = absolutePath.trim();
  const trimmedRoot = libraryRoot.trim();
  if (!trimmedPath || !trimmedRoot) return null;

  const directory = dirname(trimmedPath);
  const derived = deriveFolderSeries(directory, [trimmedPath], trimmedRoot);
  return derived.get(trimmedPath) ?? null;
}
