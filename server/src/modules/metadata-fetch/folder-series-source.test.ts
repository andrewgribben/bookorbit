import { describe, expect, it } from 'vitest';

import { folderSeriesFromFilePath } from './folder-series-source';

describe('folderSeriesFromFilePath', () => {
  it('derives a year-suffixed series name from a nested comic path', () => {
    expect(folderSeriesFromFilePath('/comics/Supergirl (2025)/Supergirl 014.cbz', '/comics')).toEqual({
      name: 'Supergirl (2025)',
      index: '14',
    });
  });

  it('returns null when the file sits at the library root', () => {
    expect(folderSeriesFromFilePath('/comics/one-shot.cbz', '/comics')).toBeNull();
  });

  it('returns null for empty paths', () => {
    expect(folderSeriesFromFilePath('', '/comics')).toBeNull();
    expect(folderSeriesFromFilePath('/comics/Supergirl (2025)/x.cbz', '')).toBeNull();
  });
});
