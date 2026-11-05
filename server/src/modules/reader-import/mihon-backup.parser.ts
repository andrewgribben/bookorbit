import { gunzipSync } from 'zlib';

/** One library entry from a Mihon-family backup (Mihon, Komikku, Tachiyomi forks share the format). */
export interface MihonBackupEntry {
  title: string;
  url: string;
  inLibrary: boolean;
  chapters: { url: string; name: string; read: boolean; chapterNumber: number | null }[];
  trackerStatuses: { trackerId: number; status: number }[];
}

type Field = { wire: number; value: number | Buffer };

// shortcut: decodes only the protobuf fields the importer reads, by field number; upgrade to a schema if more are needed.
function readFields(buf: Buffer): Map<number, Field[]> {
  const fields = new Map<number, Field[]>();
  let offset = 0;
  const varint = (): number => {
    let result = 0;
    let shift = 0;
    for (;;) {
      if (offset >= buf.length) throw new Error('Truncated varint');
      const byte = buf[offset++]!;
      result += (byte & 0x7f) * 2 ** shift;
      if (byte < 0x80) return result;
      shift += 7;
      if (shift > 63) throw new Error('Varint too long');
    }
  };
  while (offset < buf.length) {
    const key = varint();
    const fieldNumber = Math.floor(key / 8);
    const wire = key % 8;
    let value: number | Buffer;
    if (wire === 0) value = varint();
    else if (wire === 1) value = buf.subarray(offset, (offset += 8));
    else if (wire === 2) {
      const length = varint();
      if (offset + length > buf.length) throw new Error('Truncated field');
      value = buf.subarray(offset, (offset += length));
    } else if (wire === 5) value = buf.subarray(offset, (offset += 4));
    else throw new Error(`Unsupported wire type ${wire}`);
    const list = fields.get(fieldNumber) ?? [];
    list.push({ wire, value });
    fields.set(fieldNumber, list);
  }
  return fields;
}

const text = (fields: Map<number, Field[]>, n: number): string => {
  const value = fields.get(n)?.[0]?.value;
  return Buffer.isBuffer(value) ? value.toString('utf8') : '';
};
const int = (fields: Map<number, Field[]>, n: number, fallback: number): number => {
  const value = fields.get(n)?.[0]?.value;
  return typeof value === 'number' ? value : fallback;
};
const messages = (fields: Map<number, Field[]>, n: number): Map<number, Field[]>[] =>
  (fields.get(n) ?? []).flatMap((f) => (Buffer.isBuffer(f.value) ? [readFields(f.value)] : []));

/** Field numbers follow Mihon's BackupManga / BackupChapter / BackupTracking models. */
export function parseMihonBackup(file: Buffer): MihonBackupEntry[] {
  const raw = file[0] === 0x1f && file[1] === 0x8b ? gunzipSync(file, { maxOutputLength: 256 * 1024 * 1024 }) : file;
  return messages(readFields(raw), 1).map((manga) => ({
    title: text(manga, 3),
    url: text(manga, 2),
    inLibrary: int(manga, 100, 1) === 1,
    chapters: messages(manga, 16).map((chapter) => {
      const number = chapter.get(9)?.[0]?.value;
      return {
        url: text(chapter, 1),
        name: text(chapter, 2),
        read: int(chapter, 4, 0) === 1,
        chapterNumber: Buffer.isBuffer(number) && number.length === 4 ? number.readFloatLE(0) : null,
      };
    }),
    trackerStatuses: messages(manga, 18).map((track) => ({ trackerId: int(track, 1, 0), status: int(track, 9, 0) })),
  }));
}
