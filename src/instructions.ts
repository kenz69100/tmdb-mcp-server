/**
 * @fileoverview Server-level orientation sent on every `initialize`. Shared by the
 * long-running entry point (`index.ts`) and the Vercel function (`vercel.ts`).
 * @module instructions
 */

export const INSTRUCTIONS =
  'Use the tmdb_* tools for film/TV/person data via TMDB. TMDB keys on integer ids — start with ' +
  'tmdb_search_titles to resolve a name to an id, then tmdb_get_movie / tmdb_get_show / tmdb_get_person. ' +
  'tmdb_discover_titles is the power-query for filtered browsing (genre, year, rating, sort); ' +
  'tmdb_get_trending for what is hot. Streaming availability (tmdb_get_watch_providers) is region-specific — ' +
  'pass a country code; results never imply global availability. Image fields are returned as full URLs. ' +
  'This product uses the TMDB API but is not endorsed or certified by TMDB.';
