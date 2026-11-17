import { describe, expect, it, vi } from 'vitest';

import { buildTkAuthorizeUrl, parseMcpResponseBody, parseTkCallbackUrl, TkHttpError, TkMcpClient, type TkOAuthToken } from './tk-mcp-client';

function jsonResponse(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'content-type': 'application/json', ...init.headers },
  });
}

function token(overrides: Partial<TkOAuthToken> = {}): TkOAuthToken {
  return { clientId: 'client-1', accessToken: 'access-1', refreshToken: 'refresh-1', expiresAt: null, ...overrides };
}

describe('parseMcpResponseBody', () => {
  it('parses a plain JSON body', () => {
    expect(parseMcpResponseBody('{"jsonrpc":"2.0","id":1,"result":{"ok":true}}')).toEqual({ jsonrpc: '2.0', id: 1, result: { ok: true } });
  });

  it('parses an SSE body and returns the message carrying an id', () => {
    const body = 'event: message\ndata: {"jsonrpc":"2.0","id":2,"result":{"ok":true}}\n\n';
    expect(parseMcpResponseBody(body)).toEqual({ jsonrpc: '2.0', id: 2, result: { ok: true } });
  });

  it('throws when no message with an id is found', () => {
    expect(() => parseMcpResponseBody('data: {"jsonrpc":"2.0"}')).toThrow();
  });
});

describe('buildTkAuthorizeUrl', () => {
  it('includes the loopback redirect, scope and resource', () => {
    const url = buildTkAuthorizeUrl({ clientId: 'c1', codeChallenge: 'challenge', state: 'state1' });
    expect(url).toContain('redirect_uri=http%3A%2F%2F127.0.0.1%3A53682%2Fcallback');
    expect(url).toContain('scope=read+write');
    expect(url).toContain('resource=https%3A%2F%2Ftk.xyz%2Fmcp');
    expect(url).toContain('state=state1');
  });
});

describe('parseTkCallbackUrl', () => {
  it('extracts code and state from the callback URL', () => {
    expect(parseTkCallbackUrl('http://127.0.0.1:53682/callback?code=abc&state=xyz')).toEqual({ code: 'abc', state: 'xyz' });
  });

  it('throws a clear error when TK reports an error', () => {
    expect(() => parseTkCallbackUrl('http://127.0.0.1:53682/callback?error=access_denied')).toThrow(/not completed/);
  });

  it('throws on a non-URL input', () => {
    expect(() => parseTkCallbackUrl('not a url')).toThrow();
  });

  it('throws when code or state is missing', () => {
    expect(() => parseTkCallbackUrl('http://127.0.0.1:53682/callback?code=abc')).toThrow();
  });
});

describe('TkMcpClient', () => {
  it('sends the User-Agent header and echoes the session id on every call', async () => {
    const calls: { headers: Headers }[] = [];
    const fetchFn = vi.fn((_url: string, init: RequestInit) => {
      const headers = new Headers(init.headers);
      calls.push({ headers });
      if (headers.get('MCP-Protocol-Version') && (JSON.parse(init.body as string).method as string) === 'initialize') {
        return jsonResponse({ jsonrpc: '2.0', id: 1, result: {} }, { headers: { 'Mcp-Session-Id': 'sess-1' } });
      }
      if ((JSON.parse(init.body as string).method as string) === 'notifications/initialized') {
        return new Response(null, { status: 202 });
      }
      return jsonResponse({ jsonrpc: '2.0', id: 2, result: { content: [{ text: JSON.stringify({ found: false }) }] } });
    });

    const client = new TkMcpClient({ fetchFn: fetchFn as unknown as typeof fetch, token: token() });
    const result = await client.callTool('get_daily_note', { date: '2026-11-17' });

    expect(result).toEqual({ found: false });
    for (const call of calls) expect(call.headers.get('User-Agent')).toBe('bookorbit-tk-sync/1.0');
    const sessionHeaders = calls.slice(1).map((c) => c.headers.get('Mcp-Session-Id'));
    expect(sessionHeaders.every((h) => h === 'sess-1')).toBe(true);
  });

  it('refreshes the token once on a 401 and retries the same call', async () => {
    let callCount = 0;
    const refreshed: TkOAuthToken[] = [];
    const fetchFn = vi.fn((_url: string, init: RequestInit) => {
      if (_url.toString().includes('/oauth/token')) {
        return jsonResponse({ access_token: 'access-2', refresh_token: 'refresh-2', expires_in: 3600 });
      }
      const headers = new Headers(init.headers);
      const method = JSON.parse(init.body as string).method as string;
      if (method === 'initialize') return jsonResponse({ jsonrpc: '2.0', id: 1, result: {} });
      if (method === 'notifications/initialized') return new Response(null, { status: 202 });
      if (method === 'tools/call') {
        callCount += 1;
        if (headers.get('Authorization') === 'Bearer access-1') return new Response('unauthorized', { status: 401 });
        return jsonResponse({ jsonrpc: '2.0', id: 3, result: { content: [{ text: '{"ok":true}' }] } });
      }
      throw new Error(`unexpected call: ${method}`);
    });

    const client = new TkMcpClient({
      fetchFn: fetchFn as unknown as typeof fetch,
      token: token(),
      onTokenRefreshed: (t) => {
        refreshed.push(t);
      },
    });
    const result = await client.callTool('get_daily_note', { date: '2026-11-17' });

    expect(result).toEqual({ ok: true });
    expect(callCount).toBe(2);
    expect(refreshed).toHaveLength(1);
    expect(refreshed[0].accessToken).toBe('access-2');
  });

  it('throws TkHttpError on a non-401, non-2xx response', async () => {
    const fetchFn = vi.fn((_url: string, init: RequestInit) => {
      const method = JSON.parse(init.body as string).method as string;
      if (method === 'initialize') return jsonResponse({ jsonrpc: '2.0', id: 1, result: {} });
      if (method === 'notifications/initialized') return new Response(null, { status: 202 });
      return new Response('server error', { status: 500 });
    });
    const client = new TkMcpClient({ fetchFn: fetchFn as unknown as typeof fetch, token: token() });
    await expect(client.callTool('get_daily_note', { date: '2026-11-17' })).rejects.toBeInstanceOf(TkHttpError);
  });
});
