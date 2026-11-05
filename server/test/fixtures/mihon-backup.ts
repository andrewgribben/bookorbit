import { gzipSync } from 'zlib';

export interface MihonFixtureChapter {
  url: string;
  name?: string;
  read?: boolean;
  number?: number;
}

export interface MihonFixtureManga {
  url: string;
  title: string;
  inLibrary?: boolean;
  chapters: MihonFixtureChapter[];
  komgaTrackerStatus?: number;
}

function varint(value: number): number[] {
  const bytes: number[] = [];
  let rest = value;
  while (rest >= 0x80) {
    bytes.push((rest % 0x80) | 0x80);
    rest = Math.floor(rest / 0x80);
  }
  bytes.push(rest);
  return bytes;
}

const intField = (n: number, value: number) => Buffer.from([...varint(n * 8), ...varint(value)]);
const bytesField = (n: number, value: Buffer | string) => {
  const payload = typeof value === 'string' ? Buffer.from(value, 'utf8') : value;
  return Buffer.concat([Buffer.from([...varint(n * 8 + 2), ...varint(payload.length)]), payload]);
};
const floatField = (n: number, value: number) => {
  const payload = Buffer.alloc(4);
  payload.writeFloatLE(value, 0);
  return Buffer.concat([Buffer.from(varint(n * 8 + 5)), payload]);
};

/** Builds a gzipped backup in Mihon's protobuf layout, covering only the fields the importer reads. */
export function encodeMihonBackup(mangas: MihonFixtureManga[]): Buffer {
  const mangaMessages = mangas.map((manga) => {
    const parts = [intField(1, 1), bytesField(2, manga.url), bytesField(3, manga.title)];
    for (const chapter of manga.chapters) {
      const chapterParts = [bytesField(1, chapter.url), bytesField(2, chapter.name ?? chapter.url), intField(4, chapter.read ? 1 : 0)];
      if (chapter.number !== undefined) chapterParts.push(floatField(9, chapter.number));
      parts.push(bytesField(16, Buffer.concat(chapterParts)));
    }
    if (manga.komgaTrackerStatus !== undefined) parts.push(bytesField(18, Buffer.concat([intField(1, 6), intField(9, manga.komgaTrackerStatus)])));
    if (manga.inLibrary === false) parts.push(intField(100, 0));
    return bytesField(1, Buffer.concat(parts));
  });
  return gzipSync(Buffer.concat(mangaMessages));
}
