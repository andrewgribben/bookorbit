import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { ReadingServicePrivateAdapterLoaderService } from './reading-service-private-adapter-loader.service';
import { ReadingServiceRegistry } from './reading-service-registry.service';

function config(privateAdaptersDir: string | null) {
  return { encryptionKey: 'x', privateAdaptersDir };
}

describe('ReadingServicePrivateAdapterLoaderService', () => {
  it('does nothing when the env var is unset', async () => {
    const registry = new ReadingServiceRegistry();
    const service = new ReadingServicePrivateAdapterLoaderService(config(null), registry);

    await service.onModuleInit();

    expect(registry.list()).toHaveLength(0);
  });

  it('logs and does nothing when the configured directory does not exist', async () => {
    const registry = new ReadingServiceRegistry();
    const service = new ReadingServicePrivateAdapterLoaderService(config('/does/not/exist/at/all'), registry);

    await service.onModuleInit();

    expect(registry.list()).toHaveLength(0);
  });

  it('loads and registers a well-shaped default export from index.mjs', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'bookorbit-private-adapter-'));
    try {
      await writeFile(
        join(dir, 'index.mjs'),
        `export default {
          provider: 'friendwise',
          capabilities: { friends_shelf: 'read' },
          isConnected: async () => true,
          migratePage: async () => null,
          pull: async () => undefined,
        };`,
      );

      const registry = new ReadingServiceRegistry();
      const service = new ReadingServicePrivateAdapterLoaderService(config(dir), registry);

      await service.onModuleInit();

      expect(registry.has('friendwise' as any)).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('refuses a module that does not have adapter shape', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'bookorbit-private-adapter-'));
    try {
      await writeFile(join(dir, 'index.mjs'), `export default { provider: 'friendwise' };`);

      const registry = new ReadingServiceRegistry();
      const service = new ReadingServicePrivateAdapterLoaderService(config(dir), registry);

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
          capabilities: {},
          isConnected: async () => true,
          migratePage: async () => null,
          pull: async () => undefined,
        };`,
      );

      const registry = new ReadingServiceRegistry();
      const service = new ReadingServicePrivateAdapterLoaderService(config(dir), registry);

      await service.onModuleInit();

      expect(registry.list()).toHaveLength(0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
