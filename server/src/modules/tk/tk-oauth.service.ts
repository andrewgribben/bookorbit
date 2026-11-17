import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { decryptAesGcm, encryptAesGcm, parseAesGcmKey } from '../../common/secrets/aes-gcm-secret';
import { TK_OAUTH_REDIRECT_URI, TK_PENDING_OAUTH_TTL_MS } from './tk.constants';
import { TK_FETCH } from './tk.tokens';
import {
  buildTkAuthorizeUrl,
  createPkcePair,
  exchangeTkAuthorizationCode,
  parseTkCallbackUrl,
  randomUrlSafeToken,
  registerTkClient,
  type TkFetchFn,
  type TkOAuthToken,
} from './tk-mcp-client';
import { TkRepository } from './tk.repository';
import type { TkPendingOAuth, TkUserSetting } from '../../db/schema';

const ENCRYPTION_KEY_MISSING_MESSAGE = 'Set BOOK_REQUEST_ENCRYPTION_KEY before connecting TK. Generate one with: openssl rand -hex 32';

@Injectable()
export class TkOAuthService {
  private readonly key: Buffer | null;

  constructor(
    private readonly repo: TkRepository,
    config: ConfigService,
    @Inject(TK_FETCH) private readonly fetchFn: TkFetchFn,
  ) {
    this.key = parseAesGcmKey(config.get<string>('bookRequest.encryptionKey'));
  }

  /** Decrypted token for the sync path. Null when the user has not connected or the key is missing/changed. */
  getToken(settings: TkUserSetting): TkOAuthToken | null {
    if (!this.key || !settings.accessTokenEnc || !settings.refreshTokenEnc || !settings.clientId) return null;
    try {
      return {
        clientId: settings.clientId,
        accessToken: decryptAesGcm(this.key, settings.accessTokenEnc),
        refreshToken: decryptAesGcm(this.key, settings.refreshTokenEnc),
        expiresAt: settings.expiresAt?.getTime() ?? null,
      };
    } catch {
      return null;
    }
  }

  async saveRefreshedToken(userId: number, token: TkOAuthToken): Promise<void> {
    if (!this.key) return;
    await this.repo.upsertSettings(userId, {
      accessTokenEnc: encryptAesGcm(this.key, token.accessToken),
      refreshTokenEnc: encryptAesGcm(this.key, token.refreshToken),
      expiresAt: token.expiresAt ? new Date(token.expiresAt) : null,
    });
  }

  async start(userId: number, clientName = 'bookorbit-tk-sync'): Promise<{ authorizeUrl: string }> {
    this.requireKey();
    const existing = await this.repo.findSettings(userId);
    const clientId = existing?.clientId ?? (await registerTkClient(this.fetchFn, clientName)).clientId;
    const { codeVerifier, codeChallenge } = await createPkcePair();
    const state = randomUrlSafeToken(24);
    const pendingOauth: TkPendingOAuth = {
      clientId,
      codeVerifier,
      state,
      redirectUri: TK_OAUTH_REDIRECT_URI,
      createdAt: new Date().toISOString(),
    };
    await this.repo.upsertSettings(userId, { clientId, pendingOauth });
    return { authorizeUrl: buildTkAuthorizeUrl({ clientId, codeChallenge, state }) };
  }

  async finish(userId: number, callbackUrl: string, now = new Date()): Promise<void> {
    this.requireKey();
    const settings = await this.repo.findSettings(userId);
    const pending = settings?.pendingOauth;
    if (!pending) throw new BadRequestException('No TK connection is in progress. Start connecting again.');
    if (now.getTime() - new Date(pending.createdAt).getTime() > TK_PENDING_OAUTH_TTL_MS) {
      await this.repo.upsertSettings(userId, { pendingOauth: null });
      throw new BadRequestException('That connection attempt expired. Start connecting again.');
    }

    const { code, state } = parseTkCallbackUrl(callbackUrl);
    if (state !== pending.state) {
      throw new BadRequestException('That link does not match the connection you started. Start connecting again.');
    }

    const token = await exchangeTkAuthorizationCode(this.fetchFn, {
      clientId: pending.clientId,
      code,
      codeVerifier: pending.codeVerifier,
      redirectUri: pending.redirectUri,
    });

    await this.repo.upsertSettings(userId, {
      clientId: token.clientId,
      accessTokenEnc: encryptAesGcm(this.key!, token.accessToken),
      refreshTokenEnc: encryptAesGcm(this.key!, token.refreshToken),
      expiresAt: token.expiresAt ? new Date(token.expiresAt) : null,
      pendingOauth: null,
      enabled: true,
      disabledReason: null,
      connectedAt: now,
    });
  }

  async disconnect(userId: number): Promise<void> {
    await this.repo.upsertSettings(userId, {
      enabled: false,
      accessTokenEnc: null,
      refreshTokenEnc: null,
      expiresAt: null,
      clientId: null,
      pendingOauth: null,
      disabledReason: null,
      connectedAt: null,
    });
  }

  private requireKey(): void {
    if (!this.key) throw new BadRequestException(ENCRYPTION_KEY_MISSING_MESSAGE);
  }
}
