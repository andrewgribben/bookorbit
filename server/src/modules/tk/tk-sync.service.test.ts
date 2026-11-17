import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TkSyncService } from './tk-sync.service';
import { TkHttpError, TkMcpClient, TkRpcError } from './tk-mcp-client';

const BOOK_ROW = { bookId: 7, bookTitle: 'Dune', bookAuthor: 'Frank Herbert' };
const ANNOTATION = { ...BOOK_ROW, annotationId: 1, text: 'Fear is the mind-killer.', note: null, createdAt: new Date('2026-11-17T10:00:00Z') };

function emptyDoc() {
  return { type: 'doc', content: [{ type: 'paragraph', attrs: { id: 'p0' }, content: [] }] };
}

function docWithHeadingAndLink(url: string) {
  return {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 2, id: 'h1' }, content: [{ type: 'text', text: 'BookOrbit' }] },
      { type: 'blockquote', attrs: { id: 'p1' }, content: [{ type: 'text', text: 'x', marks: [{ type: 'link', attrs: { href: url } }] }] },
    ],
  };
}

function makeRepo(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    findSettings: vi.fn().mockResolvedValue({
      enabled: true,
      lastAnnotationId: 0,
      lastJournalCreatedAt: null,
      lastFinishedAt: null,
      connectedAt: null,
      backfillRequestedAt: null,
    }),
    userHasTkSyncPermission: vi.fn().mockResolvedValue(true),
    findUserTimezone: vi.fn().mockResolvedValue('UTC'),
    findPendingAnnotations: vi.fn().mockResolvedValue([]),
    findPendingJournalEntries: vi.fn().mockResolvedValue([]),
    findPendingFinishedBooks: vi.fn().mockResolvedValue([]),
    findSyncedSourceKeys: vi.fn().mockResolvedValue(new Set()),
    recordSyncedDay: vi.fn().mockResolvedValue([]),
    upsertSettings: vi.fn().mockResolvedValue({}),
    ...overrides,
  } as unknown as import('./tk.repository').TkRepository;
}

function makeOAuth() {
  return {
    getToken: vi.fn().mockReturnValue({ clientId: 'c1', accessToken: 'a1', refreshToken: 'r1', expiresAt: null }),
    saveRefreshedToken: vi.fn().mockResolvedValue(undefined),
  } as unknown as import('./tk-oauth.service').TkOAuthService;
}

function makeConfig() {
  return { appUrl: 'https://app.bookorbit.test' } as unknown as import('@nestjs/config').ConfigType<typeof import('../../config/config').appConfig>;
}

function makeService(repo: ReturnType<typeof makeRepo>, oauth: ReturnType<typeof makeOAuth>, callTool: ReturnType<typeof vi.fn>) {
  vi.spyOn(TkMcpClient.prototype, 'callTool').mockImplementation(callTool);
  return new TkSyncService(repo, oauth, makeConfig(), vi.fn() as never);
}

describe('TkSyncService.flush', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('does nothing when the user has no annotations/journal/finished items pending', async () => {
    const repo = makeRepo();
    const oauth = makeOAuth();
    const callTool = vi.fn();
    const service = makeService(repo, oauth, callTool);
    await service.flush(1);
    expect(callTool).not.toHaveBeenCalled();
  });

  it('creates a new daily note when none exists for the day', async () => {
    const repo = makeRepo({ findPendingAnnotations: vi.fn().mockResolvedValue([ANNOTATION]) });
    const oauth = makeOAuth();
    const callTool = vi.fn().mockResolvedValueOnce({ found: false }).mockResolvedValueOnce({ id: 'doc-1' });
    const service = makeService(repo, oauth, callTool);

    await service.flush(1);

    expect(callTool).toHaveBeenCalledWith('create_daily_note', expect.objectContaining({ date: '2026-11-17' }));
    expect(repo.recordSyncedDay).toHaveBeenCalledWith(
      1,
      [expect.objectContaining({ kind: 'annotation', sourceKey: '1', tkDocumentId: 'doc-1' })],
      expect.objectContaining({ lastAnnotationId: 1 }),
    );
  });

  it('handles a create-then-edit race by falling through to the edit path', async () => {
    const repo = makeRepo({ findPendingAnnotations: vi.fn().mockResolvedValue([ANNOTATION]) });
    const oauth = makeOAuth();
    const existingDoc = docWithHeadingAndLink('https://app.bookorbit.test/book/999?tab=highlights&annotationId=999');
    const callTool = vi
      .fn()
      .mockResolvedValueOnce({ found: false })
      .mockRejectedValueOnce(new TkRpcError({ code: -1, message: 'document already exists for this date' }))
      .mockResolvedValueOnce({ found: true, id: 'doc-1', content: existingDoc })
      .mockResolvedValueOnce(undefined);
    const service = makeService(repo, oauth, callTool);

    await service.flush(1);

    expect(callTool).toHaveBeenCalledWith('edit_document', expect.objectContaining({ document_id: 'doc-1' }));
    expect(repo.recordSyncedDay).toHaveBeenCalled();
  });

  it('skips re-writing an item that a crashed previous run already wrote to TK', async () => {
    const url = 'https://app.bookorbit.test/book/7?tab=highlights&annotationId=1';
    const repo = makeRepo({ findPendingAnnotations: vi.fn().mockResolvedValue([ANNOTATION]) });
    const oauth = makeOAuth();
    const existingDoc = docWithHeadingAndLink(url);
    const callTool = vi.fn().mockResolvedValueOnce({ found: true, id: 'doc-1', content: existingDoc });
    const service = makeService(repo, oauth, callTool);

    await service.flush(1);

    expect(callTool).toHaveBeenCalledTimes(1);
    expect(repo.recordSyncedDay).toHaveBeenCalledWith(1, [expect.objectContaining({ tkDocumentId: 'doc-1' })], expect.anything());
  });

  it('skips the day and records the reason when the daily note is shared', async () => {
    const repo = makeRepo({ findPendingAnnotations: vi.fn().mockResolvedValue([ANNOTATION]) });
    const oauth = makeOAuth();
    const callTool = vi
      .fn()
      .mockResolvedValueOnce({ found: true, id: 'doc-1', content: emptyDoc() })
      .mockRejectedValueOnce(new TkRpcError({ code: -1, message: 'this document is shared; pass confirm_shared to edit it' }));
    const service = makeService(repo, oauth, callTool);

    await service.flush(1);

    expect(repo.upsertSettings).toHaveBeenCalledWith(1, { disabledReason: 'daily_note_shared' });
    expect(repo.recordSyncedDay).not.toHaveBeenCalled();
  });

  it('disables TK sync when the token is rejected after refresh', async () => {
    const repo = makeRepo({ findPendingAnnotations: vi.fn().mockResolvedValue([ANNOTATION]) });
    const oauth = makeOAuth();
    const callTool = vi.fn().mockRejectedValueOnce(new TkHttpError(401, 'unauthorized'));
    const service = makeService(repo, oauth, callTool);

    await service.flush(1);

    expect(repo.upsertSettings).toHaveBeenCalledWith(1, { enabled: false, disabledReason: 'invalid_token' });
  });

  it('rethrows other errors so the caller can retry', async () => {
    const repo = makeRepo({ findPendingAnnotations: vi.fn().mockResolvedValue([ANNOTATION]) });
    const oauth = makeOAuth();
    const callTool = vi.fn().mockRejectedValueOnce(new Error('network blip'));
    const service = makeService(repo, oauth, callTool);

    await expect(service.flush(1)).rejects.toThrow('network blip');
  });

  it('only syncs items newer than connectedAt when the user has not requested a backfill', async () => {
    const olderAnnotation = { ...ANNOTATION, annotationId: 2, createdAt: new Date('2020-01-01T00:00:00Z') };
    const repo = makeRepo({
      findSettings: vi.fn().mockResolvedValue({
        enabled: true,
        lastAnnotationId: 0,
        lastJournalCreatedAt: null,
        lastFinishedAt: null,
        connectedAt: new Date('2026-01-01T00:00:00Z'),
        backfillRequestedAt: null,
      }),
      findPendingAnnotations: vi.fn().mockResolvedValue([olderAnnotation, ANNOTATION]),
    });
    const oauth = makeOAuth();
    const callTool = vi.fn().mockResolvedValueOnce({ found: false }).mockResolvedValueOnce({ id: 'doc-1' });
    const service = makeService(repo, oauth, callTool);

    await service.flush(1);

    expect(callTool.mock.calls[1][1].content).toContain('annotationId=1');
    expect(callTool.mock.calls[1][1].content).not.toContain('annotationId=2');
  });
});
