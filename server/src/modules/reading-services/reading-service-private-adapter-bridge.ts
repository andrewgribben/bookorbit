import { Logger } from '@nestjs/common';

import type {
  ReadingServiceAuthMethod,
  ReadingServiceDeviceAuthPollResult,
  ReadingServiceDeviceAuthStart,
  ReadingServiceShelf,
  ReadingServiceShelfItem,
} from '@bookorbit/types';

import { ReadingServiceCacheService } from './reading-service-cache.service';
import { ReadingServicePrivateCredentialService } from './reading-service-private-credential.service';
import type { ReadingServiceProviderAdapter } from './reading-service-provider';

const DEVICE_AUTH_CACHE_KEY = 'device_auth';
const DEVICE_AUTH_FALLBACK_TTL_MS = 15 * 60 * 1000;

/** The shape a contract-v2 private adapter module exports as its `default`. */
export interface PrivateAdapterV2Module {
  provider: string;
  permission: string;
  displayName?: string;
  description?: string | null;
  iconUrl?: string | null;
  capabilities: Record<string, string>;
  auth: { methods: ReadingServiceAuthMethod[] };
  getShelf(ctx: PrivateAdapterCtx, shelfId: string): Promise<{ items: ReadingServiceShelfItem[]; error?: 'auth_expired' | 'unavailable' }>;
  startDeviceAuth?(ctx: PrivateAdapterCtx): Promise<ReadingServiceDeviceAuthStart & { handle: unknown }>;
  pollDeviceAuth?(ctx: PrivateAdapterCtx, handle: unknown): Promise<ReadingServiceDeviceAuthPollResult & { credential?: string }>;
  validateCredential?(
    ctx: PrivateAdapterCtx,
    credential: string,
  ): Promise<{ ok: boolean; accountLabel?: string | null; reason?: 'invalid' | 'expired' | 'network' }>;
}

export interface PrivateAdapterCtx {
  userId: number;
  credential: string | null;
  logger: Pick<Logger, 'log' | 'warn' | 'error'>;
  fetch: typeof fetch;
}

interface DeviceAuthCachePayload {
  handle: unknown;
}

/**
 * Wraps a contract-v2 private adapter module (named-field default export, `ctx`-based calls,
 * no `isConnected`/`migratePage`/`pull`, auth via `auth.methods` + `startDeviceAuth`/
 * `pollDeviceAuth`/`validateCredential`) so it satisfies `ReadingServiceProviderAdapter` and the
 * controller never has to know an adapter is "private" versus built-in. Owns the one translation
 * the two contracts disagree on: `getShelf(ctx, shelfId) -> {items, error}` here becomes
 * `getShelf(userId, shelf) -> items[]` for the controller, with `auth_expired` flipping the
 * stored credential's `needsReconnect` flag instead of being surfaced as an error.
 */
export class PrivateAdapterBridge implements ReadingServiceProviderAdapter {
  readonly provider: ReadingServiceProviderAdapter['provider'];
  readonly permission: ReadingServiceProviderAdapter['permission'];
  readonly displayName?: string;
  readonly description?: string | null;
  readonly iconUrl?: string | null;
  readonly capabilities: ReadingServiceProviderAdapter['capabilities'];
  readonly authMethods: ReadingServiceAuthMethod[];

  private readonly logger: Logger;

  constructor(
    private readonly module: PrivateAdapterV2Module,
    private readonly credentials: ReadingServicePrivateCredentialService,
    private readonly cache: ReadingServiceCacheService,
  ) {
    this.logger = new Logger(`PrivateAdapter:${module.provider}`);
    this.provider = module.provider as ReadingServiceProviderAdapter['provider'];
    this.permission = module.permission as ReadingServiceProviderAdapter['permission'];
    this.displayName = module.displayName;
    this.description = module.description ?? null;
    this.iconUrl = module.iconUrl ?? null;
    this.capabilities = module.capabilities as ReadingServiceProviderAdapter['capabilities'];
    this.authMethods = module.auth.methods;
  }

  async isConnected(userId: number): Promise<boolean> {
    return this.credentials.isConnected(userId, this.module.provider);
  }

  // No sync capability for a v2, read-only social adapter. These are only ever reached if a
  // client calls a migration route for a provider that declares no migration-capable feature,
  // which the generic settings UI never offers.
  async migratePage(): Promise<Record<string, unknown> | null> {
    throw new Error(`${this.module.provider} does not support migration`);
  }

  async pull(): Promise<void> {
    throw new Error(`${this.module.provider} does not support pull`);
  }

  async getShelf(userId: number, shelf: ReadingServiceShelf): Promise<ReadingServiceShelfItem[]> {
    const credential = await this.credentials.get(userId, this.module.provider);
    const result = await this.module.getShelf(this.makeCtx(userId, credential?.credential ?? null), shelf);

    if (result.error === 'auth_expired') {
      this.logger.warn(`[reading_services.private_adapter.shelf] [fail] provider=${this.module.provider} error=auth_expired - marking needsReconnect`);
      await this.credentials.markNeedsReconnect(userId, this.module.provider);
      return [];
    }
    if (result.error) {
      this.logger.warn(`[reading_services.private_adapter.shelf] [fail] provider=${this.module.provider} error=${result.error}`);
      return [];
    }
    return result.items;
  }

  async validateCredential(userId: number, credential: string): Promise<{ ok: boolean; accountLabel?: string | null; reason?: 'invalid' | 'expired' | 'network' }> {
    if (!this.module.validateCredential) return { ok: false, reason: 'invalid' };
    return this.module.validateCredential(this.makeCtx(userId, null), credential);
  }

  async startDeviceAuth(userId: number): Promise<ReadingServiceDeviceAuthStart> {
    if (!this.module.startDeviceAuth) throw new Error(`${this.module.provider} does not support device-code sign-in`);
    const { handle, ...rest } = await this.module.startDeviceAuth(this.makeCtx(userId, null));
    const ttlMs = Math.max(0, new Date(rest.expiresAt).getTime() - Date.now()) || DEVICE_AUTH_FALLBACK_TTL_MS;
    await this.cache.set<DeviceAuthCachePayload>(userId, this.provider, DEVICE_AUTH_CACHE_KEY, { handle }, ttlMs);
    return rest;
  }

  async pollDeviceAuth(userId: number): Promise<ReadingServiceDeviceAuthPollResult> {
    if (!this.module.pollDeviceAuth) throw new Error(`${this.module.provider} does not support device-code sign-in`);
    const pending = await this.cache.get<DeviceAuthCachePayload>(userId, this.provider, DEVICE_AUTH_CACHE_KEY);
    if (!pending) return { status: 'expired', message: 'No pending sign-in for this provider.' };

    const result = await this.module.pollDeviceAuth(this.makeCtx(userId, null), pending.handle);

    if (result.status === 'approved' && result.credential) {
      await this.credentials.save(userId, this.module.provider, result.credential, result.accountLabel ?? null);
      await this.cache.set<DeviceAuthCachePayload>(userId, this.provider, DEVICE_AUTH_CACHE_KEY, { handle: null }, 0);
    } else if (result.status === 'expired' || result.status === 'denied' || result.status === 'error') {
      await this.cache.set<DeviceAuthCachePayload>(userId, this.provider, DEVICE_AUTH_CACHE_KEY, { handle: null }, 0);
    }

    return { status: result.status, accountLabel: result.accountLabel ?? null, message: result.message ?? null };
  }

  async disconnect(userId: number): Promise<void> {
    await this.credentials.disconnect(userId, this.module.provider);
  }

  private makeCtx(userId: number, credential: string | null): PrivateAdapterCtx {
    return { userId, credential, logger: this.logger, fetch: globalThis.fetch };
  }
}
