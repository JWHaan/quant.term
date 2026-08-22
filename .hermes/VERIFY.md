# Verification notes

Run: `hermes verify --port 3000`

The Vite dev server is pinned to port 3000 in vite.config.ts (`server.port: 3000`,
also used by driver.mjs and the Sites preview). Plain `hermes verify` probes the
Vite default (5173) and reports a false readiness failure.
