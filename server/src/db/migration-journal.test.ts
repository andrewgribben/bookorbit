import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';

type MigrationJournalEntry = {
  idx: number;
  version: string;
  when: number;
  tag: string;
  breakpoints: boolean;
};

type MigrationJournal = {
  version: string;
  dialect: string;
  entries: MigrationJournalEntry[];
};

const migrationsDirUrl = new URL('./migrations/', import.meta.url);
const journalPath = fileURLToPath(new URL('./meta/_journal.json', migrationsDirUrl));
const migrationsDir = fileURLToPath(migrationsDirUrl);

/**
 * Fork migrations already applied on existing databases. They stay byte-for-byte, under their
 * original tags and timestamps, after the v3.6.0 journal. Renumbering or retiming them would
 * make reconcile move the ledger cursor past upstream, so those schema changes would never run.
 * They have no idx-prefixed snapshot: drizzle-kit reads the latest snapshot file by name.
 */
const HISTORICAL_FORK_MIGRATIONS: Record<string, number> = {
  '0101_add_derive_series_from_folder': 1790700000000,
  '0102_add_user_api_keys': 1790857000000,
  '0103_add_audiobook_podcast_feeds': 1790858000000,
};

function readJournal(): MigrationJournal {
  return JSON.parse(readFileSync(journalPath, 'utf8')) as MigrationJournal;
}

function migrationPrefix(idx: number): string {
  return idx.toString().padStart(4, '0');
}

describe('Drizzle migration journal', () => {
  it('keeps migration timestamps strictly increasing in journal order', () => {
    const journal = readJournal();

    let previousDated: MigrationJournalEntry | undefined;

    for (let i = 0; i < journal.entries.length; i += 1) {
      const entry = journal.entries[i];
      const prefix = migrationPrefix(i);

      expect(entry.idx).toBe(i);
      expect(Number.isSafeInteger(entry.when)).toBe(true);
      expect(entry.when).toBeGreaterThan(0);
      expect(existsSync(fileURLToPath(new URL(`./${entry.tag}.sql`, migrationsDirUrl)))).toBe(true);

      const historicalWhen = HISTORICAL_FORK_MIGRATIONS[entry.tag];
      if (historicalWhen !== undefined) {
        expect(entry.when).toBe(historicalWhen);
        continue;
      }

      expect(entry.tag.startsWith(`${prefix}_`)).toBe(true);
      expect(existsSync(fileURLToPath(new URL(`./meta/${prefix}_snapshot.json`, migrationsDirUrl)))).toBe(true);

      if (previousDated) {
        expect(entry.when, `${entry.tag} must have a later journal timestamp than ${previousDated.tag}`).toBeGreaterThan(previousDated.when);
      }
      previousDated = entry;
    }
  });

  it('keeps the journal in sync with migration SQL files', () => {
    const journalTags = readJournal().entries.map((entry) => entry.tag);
    const fileTags = readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .map((file) => basename(file, '.sql'))
      .sort();

    expect(journalTags.slice().sort()).toEqual(fileTags);
    expect(new Set(journalTags).size).toBe(journalTags.length);
  });
});
