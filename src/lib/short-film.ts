/**
 * The app's one rule for what a short film is: a film this many minutes long or less. The discover query that finds the shorts and the check of a runtime (src/lib/tmdb.ts), and the
 * poster script that leaves them out of a montage (scripts/portraits/posters.ts), all read it from here, so they cannot drift. A leaf with no imports, so that a script can have it
 * without the server code (tmdb.ts is `server-only`).
 */
export const SHORT_MAX_MINUTES = 39;
