#!/usr/bin/env node
/**
 * @fileoverview tmdb-mcp-server MCP server entry point. Wires the TMDB tool and
 * resource surface, then in setup() constructs the TmdbService and primes its
 * startup cache (/configuration + genre maps) — failure there aborts startup loudly.
 * @module index
 */

import { createApp } from '@cyanheads/mcp-ts-core';
import { requestContextService } from '@cyanheads/mcp-ts-core/utils';
import { INSTRUCTIONS } from './instructions.js';
import { allResourceDefinitions } from './mcp-server/resources/definitions/index.js';
import { allToolDefinitions } from './mcp-server/tools/definitions/index.js';
import { initTmdbService } from './services/tmdb/tmdb-service.js';

/** Lifecycle handle for embedders and integration tests; running as a CLI ignores it. */
export const app = await createApp({
  name: 'tmdb-mcp-server',
  title: 'tmdb-mcp-server',
  /**
   * Every tool and resource here is a read-only TMDB lookup — nothing suspends on
   * `ctx.requestInput` and nothing is kept per session, so there is no session store to
   * earn. Declaring the posture in code rather than leaving it to `MCP_SESSION_MODE` puts
   * a `bunx` or from-source run on the same footing as the container, which has set
   * stateless all along.
   */
  sessionMode: 'stateless',
  instructions: INSTRUCTIONS,
  tools: allToolDefinitions,
  resources: allResourceDefinitions,
  async setup() {
    const service = initTmdbService();
    const ctx = requestContextService.createRequestContext({ operation: 'tmdb.startup-cache' });
    await service.init(ctx);
  },
});
