// Synthetic contract-v2 private adapter fixture for tests ONLY. All data below is invented;
// nothing here talks to a real network. Exercises: token-free device-code sign-in (pending ->
// approved / expired / denied), a token-only variant the loader test also uses via overrides,
// a friends shelf with one matched and one unmatched (isbn-hinted) item, and an `auth_expired`
// path so the bridge's needsReconnect wiring can be tested end to end.
let deviceAuthCallCount = 0;

export const PROVIDER = 'fixturewise';
export const PERMISSION = 'readwise_sync';

export default {
  provider: PROVIDER,
  displayName: 'Fixturewise Friends',
  description: 'Synthetic test-only friends shelf adapter.',
  iconUrl: '<svg></svg>',
  permission: PERMISSION,
  capabilities: { friends_shelf: 'read' },
  shelves: [{ id: 'friends-reading', capability: 'friends_shelf', title: 'Friends reading', description: 'Test fixture shelf.' }],

  auth: {
    methods: [
      { kind: 'device_code', label: 'Sign in with Fixturewise', help: 'Approve the code at fixturewise.test/device' },
      {
        kind: 'password',
        label: 'Sign in with username and password',
        fields: { username: { label: 'Email' }, password: { label: 'Password' } },
      },
    ],
  },

  async startDeviceAuth() {
    deviceAuthCallCount = 0;
    return {
      handle: { id: 'fixture-handle-1' },
      verificationUrl: 'https://fixturewise.test/device',
      userCode: 'ABCD-1234',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      pollIntervalSeconds: 1,
    };
  },

  async pollDeviceAuth(_ctx, handle) {
    if (!handle || handle.id !== 'fixture-handle-1') {
      return { status: 'error', message: 'unknown handle' };
    }
    deviceAuthCallCount += 1;
    if (handle.id === 'fixture-handle-expired') return { status: 'expired' };
    if (handle.id === 'fixture-handle-denied') return { status: 'denied' };
    if (deviceAuthCallCount < 2) return { status: 'pending' };
    return { status: 'approved', credential: 'fixture-credential-token', accountLabel: 'fixture-user@example.test' };
  },

  async validateCredential(_ctx, credential) {
    if (credential === 'valid-token') return { ok: true, accountLabel: 'fixture-user@example.test' };
    return { ok: false, reason: 'invalid' };
  },

  async loginWithPassword(_ctx, { username, password }) {
    if (username === 'fixture-user@example.test' && password === 'correct-password') {
      return { ok: true, credential: 'fixture-credential-from-password', accountLabel: username };
    }
    if (username === 'mfa-user@example.test') return { ok: false, reason: 'mfa_required' };
    return { ok: false, reason: 'invalid' };
  },

  async getShelf(ctx, shelfId) {
    if (shelfId !== 'friends-reading') return { items: [] };
    if (!ctx?.credential) return { items: [], error: 'auth_expired' };
    if (ctx.credential === 'expired-credential') return { items: [], error: 'auth_expired' };

    return {
      items: [
        {
          provider: PROVIDER,
          externalId: 'fixture-book-1',
          title: 'The Synthetic Testing Handbook',
          authors: ['A. Fixture'],
          coverUrl: null,
          externalUrl: 'https://fixturewise.test/book/1',
          bookId: null,
          friend: { displayName: 'Fixture Friend', avatarUrl: null, status: 'reading', date: null },
          isbn: '9780000000013',
        },
      ],
    };
  },
};
