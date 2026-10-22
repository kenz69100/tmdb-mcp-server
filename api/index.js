/**
 * @fileoverview Vercel function: forwards every HTTP method to the compiled
 * serverless handler in `dist/vercel.js` (built by `bun run build`).
 * @module api/index
 */

import { fetch } from '../dist/vercel.js';

export const GET = fetch;
export const POST = fetch;
export const DELETE = fetch;
export const OPTIONS = fetch;
export const HEAD = fetch;
