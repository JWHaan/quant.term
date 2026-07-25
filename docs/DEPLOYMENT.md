# Deployment

The repository supports OpenAI Sites/Cloudflare and Vercel from one shared build.

## Build contract

~~~bash
npm ci
npm run check
~~~

The build produces and verifies:

~~~text
dist/
├── client/      # Static browser application
├── server/      # Sites / Cloudflare Worker bundle
└── .openai/     # Sites metadata
~~~

No production environment variables are required. Do not add secrets to `VITE_*` values because they are exposed to the browser.

The deployed Strategy Lab runs the TypeScript reference replay against its
bundled deterministic fixture. The native C++20 engine is built and tested by
the quality gate but is not packaged into the static deployment.

## OpenAI Sites / Cloudflare

`wrangler.jsonc` points to `worker/index.ts`. The Worker:

- serves static files from `dist/client`
- provides the single-page fallback
- handles `/api/news` through `worker/news.ts`

`scripts/verify-sites-build.mjs` fails the build if the expected Worker, client, metadata, or SPA settings are missing.

## Vercel

`vercel.json` publishes `dist/client`. `api/vercel-news.ts` exposes the same shared news handler as a Vercel Function without colliding with the local Worker's `/api/news` route.

After authenticating and linking the project:

~~~bash
npx vercel
npx vercel --prod
~~~

Vercel rewrites `/api/news` to the Function before applying the SPA fallback, so browser routes still fall back to `/index.html`.

## Smoke tests

Verify each deployment with:

~~~text
GET /                         -> 200 HTML
GET /some/deep/path           -> 200 SPA HTML
GET /api/news?limit=1         -> 200 JSON, or explicit 502 JSON if both RSS providers fail
GET /assets/<built-file>      -> 200 immutable asset
~~~

Then open the terminal and confirm:

1. market-watch prices update,
2. the selected-symbol chart loads history and advances,
3. the DOM reports a live link,
4. derivatives and network panels show data or an honest unavailable state,
5. a refresh on a deep browser route does not return 404.
6. Monitor and Strategy Lab switch without showing live-feed errors in replay mode,
7. Strategy Lab starts without placeholder metrics and produces a trade ledger only after an explicit run.
