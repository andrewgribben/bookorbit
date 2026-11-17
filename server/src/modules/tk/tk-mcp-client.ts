import { Buffer } from 'node:buffer';

import {
  TK_MCP_PROTOCOL_VERSION,
  TK_MCP_URL,
  TK_OAUTH_AUTHORIZE_URL,
  TK_OAUTH_REDIRECT_URI,
  TK_OAUTH_REGISTER_URL,
  TK_OAUTH_SCOPE,
  TK_OAUTH_TOKEN_URL,
  TK_USER_AGENT,
} from './tk.constants';

export type TkFetchFn = typeof fetch;

export interface TkOAuthToken {
  clientId: string;
  accessToken: string;
  refreshToken: string;
  /** Epoch milliseconds, or null when TK did not report an expiry. */
  expiresAt: number | null;
}

export interface TkRegisteredClient {
  clientId: string;
}

export interface TkPkcePair {
  codeVerifier: string;
  codeChallenge: string;
}

/** Thrown when TK's JSON-RPC layer returns a JSON-RPC error object. */
export class TkRpcError extends Error {
  constructor(public readonly rpcError: { code: number; message: string; data?: unknown }) {
    super(rpcError.message);
    this.name = 'TkRpcError';
  }
}

/** Thrown on a non-2xx HTTP response from the TK API. */
export class TkHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
  ) {
    super(`TK request failed with status ${status}`);
    this.name = 'TkHttpError';
  }
}

function base64UrlEncode(buffer: ArrayBuffer): string {
  return Buffer.from(buffer).toString('base64url');
}

export function randomUrlSafeToken(byteLength = 48): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes.buffer);
}

export async function createPkcePair(): Promise<TkPkcePair> {
  const codeVerifier = randomUrlSafeToken(64);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));
  return { codeVerifier, codeChallenge: base64UrlEncode(digest) };
}

export function buildTkAuthorizeUrl(params: { clientId: string; codeChallenge: string; state: string; redirectUri?: string }): string {
  const query = new URLSearchParams({
    response_type: 'code',
    client_id: params.clientId,
    redirect_uri: params.redirectUri ?? TK_OAUTH_REDIRECT_URI,
    scope: TK_OAUTH_SCOPE,
    code_challenge: params.codeChallenge,
    code_challenge_method: 'S256',
    state: params.state,
    resource: TK_MCP_URL,
  });
  return `${TK_OAUTH_AUTHORIZE_URL}?${query.toString()}`;
}

/** Parses the pasted-back callback URL from the loopback redirect page (see "Connect flow"). */
export function parseTkCallbackUrl(callbackUrl: string): { code: string; state: string } {
  let url: URL;
  try {
    url = new URL(callbackUrl);
  } catch {
    throw new Error('That does not look like a URL. Paste the full address from the browser bar.');
  }
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  if (error) throw new Error(`TK sign-in was not completed: ${error}`);
  if (!code || !state) throw new Error('That URL is missing a code or state parameter.');
  return { code, state };
}

export async function registerTkClient(fetchFn: TkFetchFn, clientName: string): Promise<TkRegisteredClient> {
  const res = await fetchFn(TK_OAUTH_REGISTER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': TK_USER_AGENT },
    body: JSON.stringify({
      client_name: clientName,
      redirect_uris: [TK_OAUTH_REDIRECT_URI],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    }),
  });
  const body = await res.text();
  if (!res.ok) throw new TkHttpError(res.status, body);
  const parsed = JSON.parse(body) as { client_id: string };
  return { clientId: parsed.client_id };
}

interface TkTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
}

function toOAuthToken(clientId: string, body: TkTokenResponse, fallbackRefreshToken?: string): TkOAuthToken {
  const refreshToken = body.refresh_token ?? fallbackRefreshToken;
  if (!refreshToken) throw new Error('TK token response carried no refresh token');
  return {
    clientId,
    accessToken: body.access_token,
    refreshToken,
    expiresAt: typeof body.expires_in === 'number' ? Date.now() + body.expires_in * 1000 : null,
  };
}

export async function exchangeTkAuthorizationCode(
  fetchFn: TkFetchFn,
  params: { clientId: string; code: string; codeVerifier: string; redirectUri?: string },
): Promise<TkOAuthToken> {
  const res = await fetchFn(TK_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': TK_USER_AGENT },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: params.code,
      redirect_uri: params.redirectUri ?? TK_OAUTH_REDIRECT_URI,
      client_id: params.clientId,
      code_verifier: params.codeVerifier,
      resource: TK_MCP_URL,
    }).toString(),
  });
  const body = await res.text();
  if (!res.ok) throw new TkHttpError(res.status, body);
  return toOAuthToken(params.clientId, JSON.parse(body) as TkTokenResponse);
}

export async function refreshTkToken(fetchFn: TkFetchFn, token: TkOAuthToken): Promise<TkOAuthToken> {
  const res = await fetchFn(TK_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': TK_USER_AGENT },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: token.refreshToken,
      client_id: token.clientId,
      resource: TK_MCP_URL,
    }).toString(),
  });
  const body = await res.text();
  if (!res.ok) throw new TkHttpError(res.status, body);
  return toOAuthToken(token.clientId, JSON.parse(body) as TkTokenResponse, token.refreshToken);
}

interface JsonRpcMessage {
  jsonrpc: '2.0';
  id?: number;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

/** The response body is JSON or SSE (`data:` lines); return the message carrying an `id`. */
export function parseMcpResponseBody(body: string): JsonRpcMessage {
  const trimmed = body.trim();
  if (trimmed.startsWith('{')) return JSON.parse(trimmed) as JsonRpcMessage;
  for (const line of trimmed.split('\n')) {
    if (!line.startsWith('data:')) continue;
    const message = JSON.parse(line.slice('data:'.length).trim()) as JsonRpcMessage;
    if (message.id !== undefined) return message;
  }
  throw new Error(`Could not parse MCP response: ${trimmed.slice(0, 500)}`);
}

export interface TkMcpClientOptions {
  fetchFn: TkFetchFn;
  token: TkOAuthToken;
  clientInfo?: { name: string; version: string };
  onTokenRefreshed?: (token: TkOAuthToken) => void | Promise<void>;
}

/**
 * Minimal MCP JSON-RPC client over TK's Streamable HTTP endpoint: OAuth-aware (refreshes once on
 * 401 and retries), session-aware (echoes `Mcp-Session-Id`), and tolerant of both JSON and SSE
 * response bodies. No `obsidian`/Nest dependency; `fetchFn` is injected so tests never hit the network.
 */
export class TkMcpClient {
  private token: TkOAuthToken;
  private sessionId: string | null = null;
  private nextId = 0;
  private initialized: Promise<void> | null = null;

  constructor(private readonly options: TkMcpClientOptions) {
    this.token = options.token;
  }

  getToken(): TkOAuthToken {
    return this.token;
  }

  async ensureInitialized(): Promise<void> {
    this.initialized ??= this.initialize();
    return this.initialized;
  }

  private async initialize(): Promise<void> {
    await this.rpc('initialize', {
      protocolVersion: TK_MCP_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: this.options.clientInfo ?? { name: 'bookorbit-tk-sync', version: '1.0' },
    });
    await this.rpc('notifications/initialized', undefined, { notify: true });
  }

  async callTool<T = unknown>(name: string, args: Record<string, unknown>): Promise<T> {
    await this.ensureInitialized();
    const result = await this.rpc('tools/call', { name, arguments: args });
    const parsed = result as { content?: { text?: string }[] };
    const text = parsed.content?.[0]?.text;
    if (text === undefined) throw new Error(`TK tool '${name}' returned no content`);
    return JSON.parse(text) as T;
  }

  private async rpc(method: string, params: unknown, options: { notify?: boolean; isRetry?: boolean } = {}): Promise<unknown> {
    const message: Record<string, unknown> = { jsonrpc: '2.0', method };
    if (params !== undefined) message.params = params;
    if (!options.notify) {
      this.nextId += 1;
      message.id = this.nextId;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      Authorization: `Bearer ${this.token.accessToken}`,
      'MCP-Protocol-Version': TK_MCP_PROTOCOL_VERSION,
      'User-Agent': TK_USER_AGENT,
    };
    if (this.sessionId) headers['Mcp-Session-Id'] = this.sessionId;

    const res = await this.options.fetchFn(TK_MCP_URL, { method: 'POST', headers, body: JSON.stringify(message) });

    if (res.status === 401 && !options.isRetry) {
      this.token = await refreshTkToken(this.options.fetchFn, this.token);
      await this.options.onTokenRefreshed?.(this.token);
      return this.rpc(method, params, { ...options, isRetry: true });
    }

    const sessionHeader = res.headers.get('Mcp-Session-Id') ?? res.headers.get('mcp-session-id');
    if (!this.sessionId && sessionHeader) this.sessionId = sessionHeader;

    if (options.notify) {
      if (!res.ok) throw new TkHttpError(res.status, await res.text());
      return undefined;
    }

    const body = await res.text();
    if (!res.ok) throw new TkHttpError(res.status, body);
    const parsed = parseMcpResponseBody(body);
    if (parsed.error) throw new TkRpcError(parsed.error);
    return parsed.result;
  }
}
