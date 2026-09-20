/**
 * @fileoverview Boots the real entry point over HTTP with no `MCP_SESSION_MODE` in the
 * environment and asserts the posture it actually resolves to. A 2025-era `initialize` is
 * the one request that tells the two modes apart: the sessionful arm mints an
 * `Mcp-Session-Id` and returns it, and stateless serving never reaches that arm. The
 * declared-option half lives in `tests/index.session-mode.test.ts`.
 * @module tests/index.http-session
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { mockFetchWithTimeout, STARTUP_ROUTES, setRoutes } from './helpers/mock-tmdb.js';

/**
 * Clear of the server's own 3010 default. Repeated as a literal in the hoisted block
 * below, which runs before this binding exists.
 */
const ORIGIN = 'http://127.0.0.1:39411';

/**
 * Hoisted above the module imports: the framework parses its config when it is first
 * imported, so setting these inside a hook would be too late. `MCP_SESSION_MODE` is
 * deliberately cleared — the point of the test is that `createApp({ sessionMode })`
 * decides the posture when the environment says nothing.
 */
vi.hoisted(() => {
  delete process.env.MCP_SESSION_MODE;
  process.env.TMDB_API_KEY = 'test-bearer-token';
  process.env.MCP_TRANSPORT_TYPE = 'http';
  process.env.MCP_HTTP_HOST = '127.0.0.1';
  process.env.MCP_HTTP_PORT = '39411';
  process.env.MCP_AUTH_MODE = 'none';
  process.env.MCP_LOG_LEVEL = 'error';
  process.env.MCP_FORCE_CONSOLE_LOGGING = 'true';
});

/**
 * The entry point's `setup()` primes the startup cache against TMDB, so the boot needs a
 * routed fetch the same way every handler test does. Only `fetchWithTimeout` is replaced;
 * the entry point's own `requestContextService` import stays real.
 */
vi.mock('@cyanheads/mcp-ts-core/utils', async (importActual) => {
  const actual = await importActual<typeof import('@cyanheads/mcp-ts-core/utils')>();
  return { ...actual, fetchWithTimeout: mockFetchWithTimeout };
});

let shutdown: () => Promise<void>;

beforeAll(async () => {
  setRoutes(STARTUP_ROUTES);
  const entry = await import('@/index.js');
  shutdown = () => entry.app.shutdown('test');
});

afterAll(async () => {
  await shutdown?.();
});

/** A 2025-era `initialize` — the revision whose sessionful arm would return a session id. */
async function legacyInitialize(): Promise<Response> {
  return await fetch(`${ORIGIN}/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-11-25',
        capabilities: {},
        clientInfo: { name: 'tmdb-session-mode-test', version: '0.0.0' },
      },
    }),
  });
}

describe('resolved HTTP session posture', () => {
  it('answers a 2025-era initialize without minting a session', async () => {
    const res = await legacyInitialize();

    /**
     * Asserted before the header so a transport-level failure reports as itself rather
     * than as a passing "no session id" — an errored response carries no header either.
     */
    expect(res.ok).toBe(true);
    expect(res.headers.get('mcp-session-id')).toBeNull();
  });

  it('completes the 2025-era handshake, so the missing header is a posture and not a failure', async () => {
    const res = await legacyInitialize();
    const body = await res.text();

    /** Hono answers an `initialize` as JSON or as a single SSE frame depending on Accept. */
    const payload = body.startsWith('event:')
      ? JSON.parse(body.slice(body.indexOf('data: ') + 'data: '.length).split('\n')[0] ?? '{}')
      : JSON.parse(body);

    expect(payload.error).toBeUndefined();
    expect(payload.result?.protocolVersion).toBeTypeOf('string');
    expect(payload.result?.serverInfo?.name).toBe('tmdb-mcp-server');
  });

  it('publishes stateless on the server card', async () => {
    const res = await fetch(`${ORIGIN}/.well-known/mcp.json`);
    expect(res.ok).toBe(true);

    const card = (await res.json()) as { _meta?: Record<string, unknown> };
    expect(card._meta?.['io.github.cyanheads.mcp-ts-core/sessionMode']).toBe('stateless');
  });

  it('serves a request carrying a session id it never issued, rather than resuming one', async () => {
    const res = await fetch(`${ORIGIN}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'Mcp-Session-Id': 'not-a-session-this-server-issued',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }),
    });

    /**
     * There is no session table to look the id up in, so it is neither honored nor a
     * reason to refuse: the request is answered on its own terms. Under stateful serving
     * the same call is a 404 against the unknown session.
     */
    expect(res.status).toBe(200);
    expect(res.headers.get('mcp-session-id')).toBeNull();
    expect(await res.text()).toContain('tmdb_search_titles');
  });
});
