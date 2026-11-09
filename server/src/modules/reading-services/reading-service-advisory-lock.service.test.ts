import { describe, expect, it, vi } from 'vitest';

import { ReadingServiceAdvisoryLockService } from './reading-service-advisory-lock.service';

function makeDb(lockedSequence: boolean[]) {
  let call = 0;
  const tx = {
    execute: vi.fn().mockImplementation(() => {
      const locked = lockedSequence[call] ?? lockedSequence[lockedSequence.length - 1];
      call += 1;
      return Promise.resolve({ rows: [{ locked }] });
    }),
  };
  const db = {
    transaction: vi.fn().mockImplementation((fn: (transaction: typeof tx) => Promise<unknown>) => fn(tx)),
  };
  return { db, tx };
}

describe('ReadingServiceAdvisoryLockService', () => {
  it('runs fn when the lock is free', async () => {
    const { db } = makeDb([true]);
    const service = new ReadingServiceAdvisoryLockService(db as any);
    const fn = vi.fn().mockResolvedValue('done');

    const result = await service.runExclusive('readwise_sessions_push', 1, fn);

    expect(result).toBe('done');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('skips fn and returns null when the lock is already held', async () => {
    const { db } = makeDb([false]);
    const service = new ReadingServiceAdvisoryLockService(db as any);
    const fn = vi.fn().mockResolvedValue('done');

    const result = await service.runExclusive('readwise_sessions_push', 1, fn);

    expect(result).toBeNull();
    expect(fn).not.toHaveBeenCalled();
  });

  it('a second concurrent call for the same user+operation is skipped while the first holds the lock', async () => {
    // Simulates two overlapping calls racing for the same advisory lock key: the first
    // acquires it (locked=true), the second (still inside the first's critical section on a
    // real database) finds it held (locked=false).
    const { db } = makeDb([true, false]);
    const service = new ReadingServiceAdvisoryLockService(db as any);
    const firstFn = vi.fn().mockResolvedValue('first');
    const secondFn = vi.fn().mockResolvedValue('second');

    const [firstResult, secondResult] = await Promise.all([
      service.runExclusive('readwise_sessions_push', 42, firstFn),
      service.runExclusive('readwise_sessions_push', 42, secondFn),
    ]);

    expect(firstResult).toBe('first');
    expect(secondResult).toBeNull();
    expect(firstFn).toHaveBeenCalledTimes(1);
    expect(secondFn).not.toHaveBeenCalled();
  });

  it('builds the lock key from operation and userId so different users never collide', async () => {
    const { db, tx } = makeDb([true]);
    const service = new ReadingServiceAdvisoryLockService(db as any);
    await service.runExclusive('readwise_books_pull', 7, () => Promise.resolve(undefined));

    const call = tx.execute.mock.calls[0]![0] as { queryChunks: unknown[] };
    const text = call.queryChunks
      .map((chunk) => (chunk && typeof chunk === 'object' && 'value' in chunk ? (chunk as { value: string[] }).value.join('') : String(chunk)))
      .join('');
    expect(text).toContain('pg_try_advisory_xact_lock');
    expect(text).toContain('readwise_books_pull:7');
  });
});
