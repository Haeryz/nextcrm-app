// `server-only` is a Next.js build-time guard: importing it from a client bundle is
// a hard error. Jest has no such notion of bundles, and under pnpm's strict linking
// the real package isn't resolvable from here anyway, so map it to a no-op. This
// lets modules that (correctly) mark themselves server-only still be unit-tested.
export {};
