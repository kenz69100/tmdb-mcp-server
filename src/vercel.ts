/**
 * @fileoverview Vercel Functions entry point. Reuses the framework's web-standard
 * serverless handler (`createWorkerHandler`) on Vercel's Node runtime: one stateless
 * request in, one response out, nothing kept between invocations. The TMDB startup
 * cache is primed lazily on the first request of each instance.
 * @module vercel
 */

import { requestContextService } from '@cyanheads/mcp-ts-core/utils';
import { createWorkerHandler } from '@cyanheads/mcp-ts-core/worker';
import { INSTRUCTIONS } from './instructions.js';
import { allResourceDefinitions } from './mcp-server/resources/definitions/index.js';
import { allToolDefinitions } from './mcp-server/tools/definitions/index.js';
import { initTmdbService } from './services/tmdb/tmdb-service.js';

const handler = createWorkerHandler({
  name: 'tmdb-mcp-server',
  title: 'tmdb-mcp-server',
  /** Serverless instances share no memory, so a session id minted on one would be unknown to the next. */
  sessionMode: 'stateless',
  instructions: INSTRUCTIONS,
  tools: allToolDefinitions,
  resources: allResourceDefinitions,
  async setup() {
    const service = initTmdbService();
    await service.init(
      requestContextService.createRequestContext({ operation: 'tmdb.startup-cache' }),
    );
  },
});

/** Vercel has no Cloudflare execution context; the framework never calls these. */
const executionContext = { waitUntil() {}, passThroughOnException() {} };

/**
 * Vercel routes every path to `/api` (see `vercel.json`); `x-original-path` is not
 * guaranteed, so the original URL is rebuilt from the rewrite's `path` query param.
 */
export function fetch(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = url.searchParams.get('__path');
  if (path !== null) {
    url.searchParams.delete('__path');
    url.pathname = `/${path}`;
    request = new Request(url, request);
  }
  return handler.fetch(request, process.env as never, executionContext as never);
}
