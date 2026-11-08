import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';

import { Permission, READING_SERVICE_PROVIDERS } from '@bookorbit/types';

import { sanitizeLogValue } from '../../common/utils/log-sanitize.utils';
import { readingServicesConfig } from '../../config/config';
import { ReadingServiceCacheService } from './reading-service-cache.service';
import { ReadingServicePrivateCredentialService } from './reading-service-private-credential.service';
import type { PrivateAdapterV2Module } from './reading-service-private-adapter-bridge';
import { PrivateAdapterBridge } from './reading-service-private-adapter-bridge';
import type { ReadingServiceProviderAdapter } from './reading-service-provider';
import { ReadingServiceRegistry } from './reading-service-registry.service';

const ENTRYPOINTS = ['index.mjs', 'index.js'];

// Same CJS/ESM straddle as the request-indexer plugin loader: the built server is CommonJS, so a
// plain `import()` is rewritten to `require()` there and cannot load an ES module; Vitest runs
// the source as real ESM, where the indirect `Function` form has no import callback. Whichever
// environment this runs in, one of the two works.
// eslint-disable-next-line @typescript-eslint/no-implied-eval -- needed to preserve runtime dynamic import in CJS output
const importViaFunction = new Function('specifier', 'return import(specifier);') as (specifier: string) => Promise<unknown>;

async function importModule(specifier: string): Promise<unknown> {
  try {
    return await (import(specifier) as Promise<unknown>);
  } catch {
    return await importViaFunction(specifier);
  }
}

function isValidPermission(value: unknown): value is Permission {
  return typeof value === 'string' && (Object.values(Permission) as string[]).includes(value);
}

/** Contract v1: a sync-capable adapter (isConnected/migratePage/pull), registered as-is. */
function hasV1AdapterShape(value: unknown): value is ReadingServiceProviderAdapter {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ReadingServiceProviderAdapter>;
  return (
    typeof candidate.provider === 'string' &&
    typeof candidate.capabilities === 'object' &&
    candidate.capabilities !== null &&
    isValidPermission(candidate.permission) &&
    typeof candidate.isConnected === 'function' &&
    typeof candidate.migratePage === 'function' &&
    typeof candidate.pull === 'function'
  );
}

/**
 * Contract v2: a read-only, auth-first adapter (e.g. the personal Readwise-friends module) with
 * no sync/migration surface at all - just `capabilities`, `auth.methods`, and `getShelf`. Wrapped
 * in `PrivateAdapterBridge` before registration so the rest of the host never has to branch on
 * which contract a given adapter speaks.
 */
function hasV2AdapterShape(value: unknown): value is PrivateAdapterV2Module {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<PrivateAdapterV2Module>;
  return (
    typeof candidate.provider === 'string' &&
    typeof candidate.capabilities === 'object' &&
    candidate.capabilities !== null &&
    isValidPermission(candidate.permission) &&
    typeof candidate.auth === 'object' &&
    candidate.auth !== null &&
    Array.isArray(candidate.auth.methods) &&
    candidate.auth.methods.length > 0 &&
    typeof candidate.getShelf === 'function'
  );
}

/**
 * Loads an optional, operator-supplied provider module at boot and registers it with the same
 * `ReadingServiceRegistry` the committed Readwise and Hardcover adapters use (plan phase 2 item
 * 5, e.g. the personal Readwise-friends POC referenced in the research doc).
 *
 * SECURITY: a module loaded here runs inside this process with this process's full reach
 * (database access, every other injected service, the user's decrypted tokens) - the same trust
 * boundary `PluginLoaderService` documents for indexer plugins. It must:
 *  - never ship inside the application: the personal adapter is pinned only as the private git
 *    submodule `private/readwise-accessibility-poc`, which `.dockerignore` keeps out of the image,
 *    and nothing under `server/src` imports it;
 *  - only be pointed at by an operator who deliberately set `READING_SERVICES_PRIVATE_ADAPTERS_DIR`
 *    to a path they trust, outside the deployed application tree;
 *  - be treated as equivalent to giving that code admin access to the BookOrbit instance.
 * The env var is unset by default, so a stock BookOrbit install never attempts to load anything
 * here and this class is a no-op.
 */
@Injectable()
export class ReadingServicePrivateAdapterLoaderService implements OnModuleInit {
  private readonly logger = new Logger(ReadingServicePrivateAdapterLoaderService.name);

  constructor(
    @Inject(readingServicesConfig.KEY) private readonly config: ConfigType<typeof readingServicesConfig>,
    private readonly registry: ReadingServiceRegistry,
    private readonly credentials: ReadingServicePrivateCredentialService,
    private readonly cache: ReadingServiceCacheService,
  ) {}

  async onModuleInit(): Promise<void> {
    const dir = this.config.privateAdaptersDir;
    if (!dir) {
      this.logger.log('[reading_services.private_adapter] [end] configured=false - no READING_SERVICES_PRIVATE_ADAPTERS_DIR set, nothing loaded');
      return;
    }

    this.logger.warn(
      `[reading_services.private_adapter] [start] dir="${sanitizeLogValue(dir)}" - loading an operator-supplied adapter; it runs with full process access, see the class doc comment`,
    );

    let entries: string[];
    try {
      entries = (await readdir(dir)).filter((name) => ENTRYPOINTS.includes(name));
    } catch (err) {
      this.logger.warn(
        `[reading_services.private_adapter] [fail] dir="${sanitizeLogValue(dir)}" error="${sanitizeLogValue(err instanceof Error ? err.message : String(err))}" - directory not readable, nothing loaded`,
      );
      return;
    }

    if (entries.length === 0) {
      this.logger.warn(`[reading_services.private_adapter] [fail] dir="${sanitizeLogValue(dir)}" - no index.mjs or index.js found, nothing loaded`);
      return;
    }

    let loaded = 0;
    for (const entry of entries) {
      const path = join(dir, entry);
      try {
        const url = `${pathToFileURL(path).href}?loaded=${Date.now()}`;
        const module = (await importModule(url)) as { default?: unknown };
        const exported = module.default;

        let adapter: ReadingServiceProviderAdapter;
        if (hasV1AdapterShape(exported)) {
          adapter = exported;
        } else if (hasV2AdapterShape(exported)) {
          adapter = new PrivateAdapterBridge(exported, this.credentials, this.cache);
        } else {
          throw new Error(
            'the module has no default export shaped like a v1 (isConnected/migratePage/pull) or v2 (auth.methods/getShelf) ' +
              'ReadingServiceProviderAdapter, or its `permission` is not an existing Permission enum member',
          );
        }

        if (READING_SERVICE_PROVIDERS.includes(adapter.provider)) {
          throw new Error(`"${adapter.provider}" is already a built-in provider and cannot be overridden`);
        }
        if (this.registry.has(adapter.provider)) {
          throw new Error(`a provider named "${adapter.provider}" is already registered`);
        }

        this.registry.register(adapter);
        loaded += 1;
      } catch (err) {
        this.logger.warn(
          `[reading_services.private_adapter] [fail] dir="${sanitizeLogValue(dir)}" file="${sanitizeLogValue(entry)}" error="${sanitizeLogValue(err instanceof Error ? err.message : String(err))}" - adapter not loaded`,
        );
      }
    }

    this.logger.log(
      `[reading_services.private_adapter] [end] dir="${sanitizeLogValue(dir)}" loaded=${loaded} scanned=${entries.length} - private adapter load finished`,
    );
  }
}
