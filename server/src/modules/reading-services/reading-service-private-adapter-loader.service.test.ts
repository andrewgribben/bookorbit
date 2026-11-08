import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { vi } from 'vitest';

import { ReadingServicePrivateAdapterLoaderService } from './reading-service-private-adapter-loader.service';
import { ReadingServiceRegistry } from './reading-service-registry.service';

function config(privateAdaptersDir: string | null) {
  return { encryptionKey: 'x', privateAdaptersDir };
}

function makeLoader(dir: string | null, registry = new ReadingServiceRegistry()) {
  const credentials = { get: vi.fn(), isConnected: vi.fn().mockResolvedValue(false), save: vi.fn(), markNeedsReconnect: vi.fn(), disconnect: vi.fn() };
  const cache = { get: vi.fn(), set: vi.fn() };
  return {
    registry,
    service: new ReadingServicePrivateAdapterLoaderService(config(dir), registry, credentials as never, cache as never),
  };
}

describe('ReadingServicePrivateAdapterLoaderService', () => {
  it('does nothing when the env var is unset', async () => {
    const { registry, service } = makeLoader(null);

    await service.onModuleInit();

    expect(registry.list()).toHaveLength(0);
  });

  it('logs and does nothing when the configured directory does not exist', async () => {
    const { registry, service } = makeLoader('/does/not/exist/at/all');

    await service.onModuleInit();

    expect(registry.list()).toHaveLength(0);
  });

  it('loads and registers a well-shaped v1 default export from index.mjs', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'bookorbit-private-adapter-'));
    try {
      await writeFile(
        join(dir, 'index.mjs'),
        `export default {
          provider: 'friendwise',
          permission: 'readwise_sync',
          capabilities: { friends_shelf: 'read' },
          isConnected: async () => true,
          migratePage: async () => null,
          pull: async () => undefined,
        };`,
      );

      const { registry, service } = makeLoader(dir);

      await service.onModuleInit();

      expect(registry.has('friendwise' as any)).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('loads and registers a v2 (auth.methods/getShelf, no sync surface) default export, wrapped in the bridge', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'bookorbit-private-adapter-'));
    try {
      await writeFile(
        join(dir, 'index.mjs'),
        `export default {
          provider: 'fixturewise-v2',
          displayName: 'Fixturewise V2',
          permission: 'readwise_sync',
          capabilities: { friends_shelf: 'read' },
          auth: { methods: [{ kind: 'device_code', label: 'Sign in' }] },
          getShelf: async () => ({ items: [] }),
        };`,
      );

      const { registry, service } = makeLoader(dir);

      await service.onModuleInit();

      const adapter = registry.get('fixturewise-v2');
      expect(adapter).toBeDefined();
      expect(adapter?.displayName).toBe('Fixturewise V2');
      expect(adapter?.authMethods).toEqual([{ kind: 'device_code', label: 'Sign in' }]);
      // No sync surface at all - the bridge rejects instead of crashing on an undefined call.
      await expect(adapter?.migratePage(1, {}, {} as never)).rejects.toThrow();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('refuses a module that does not have adapter shape (neither v1 nor v2)', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'bookorbit-private-adapter-'));
    try {
      await writeFile(join(dir, 'index.mjs'), `export default { provider: 'friendwise' };`);

      const { registry, service } = makeLoader(dir);

      await service.onModuleInit();

      expect(registry.list()).toHaveLength(0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('refuses a v2-shaped module whose permission is not an existing Permission enum member', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'bookorbit-private-adapter-'));
    try {
      await writeFile(
        join(dir, 'index.mjs'),
        `export default {
          provider: 'fixturewise-v2',
          permission: 'not_a_real_permission',
          capabilities: {},
          auth: { methods: [{ kind: 'device_code', label: 'Sign in' }] },
          getShelf: async () => ({ items: [] }),
        };`,
      );

      const { registry, service } = makeLoader(dir);

      await service.onModuleInit();

      expect(registry.list()).toHaveLength(0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('refuses a module claiming a built-in provider name', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'bookorbit-private-adapter-'));
    try {
      await writeFile(
        join(dir, 'index.mjs'),
        `export default {
          provider: 'hardcover',
          permission: 'hardcover_sync',
          capabilities: {},
          isConnected: async () => true,
          migratePage: async () => null,
          pull: async () => undefined,
        };`,
      );

      const { registry, service } = makeLoader(dir);

      await service.onModuleInit();

      expect(registry.list()).toHaveLength(0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
