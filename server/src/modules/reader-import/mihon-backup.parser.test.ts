import { encodeMihonBackup } from '../../../test/fixtures/mihon-backup';
import { parseMihonBackup } from './mihon-backup.parser';

describe('parseMihonBackup', () => {
  it('reads library entries, chapters and tracker statuses', () => {
    const backup = encodeMihonBackup([
      {
        url: 'https://komga.example/api/v1/series/S1',
        title: 'Supergirl',
        komgaTrackerStatus: 3,
        chapters: [
          { url: 'https://komga.example/api/v1/books/B1', name: '1 - Supergirl 1', read: true, number: 1 },
          { url: 'https://komga.example/api/v1/books/B2', number: 2.5 },
        ],
      },
      { url: 'https://komga.example/api/v1/series/S2', title: 'Only in history', inLibrary: false, chapters: [] },
    ]);

    expect(parseMihonBackup(backup)).toEqual([
      {
        title: 'Supergirl',
        url: 'https://komga.example/api/v1/series/S1',
        inLibrary: true,
        chapters: [
          { url: 'https://komga.example/api/v1/books/B1', name: '1 - Supergirl 1', read: true, chapterNumber: 1 },
          { url: 'https://komga.example/api/v1/books/B2', name: 'https://komga.example/api/v1/books/B2', read: false, chapterNumber: 2.5 },
        ],
        trackerStatuses: [{ trackerId: 6, status: 3 }],
      },
      { title: 'Only in history', url: 'https://komga.example/api/v1/series/S2', inLibrary: false, chapters: [], trackerStatuses: [] },
    ]);
  });

  it('rejects data that is not a backup', () => {
    expect(() => parseMihonBackup(Buffer.from([0x0a, 0xff, 0xff]))).toThrow();
  });
});
