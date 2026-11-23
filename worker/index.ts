import { handleNewsRequest } from './news'

interface AssetsBinding {
  fetch(request: Request): Promise<Response>
}

interface Env {
  ASSETS: AssetsBinding
}

const SECURITY_HEADERS: Record<string, string> = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
}

const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable'

/**
 * Site-wide security headers, applied on the response path because Workers
 * Static Assets does not read the Pages `public/_headers` convention.
 * Fingerprinted build assets under /assets/ also get an immutable cache policy.
 */
const withSecurityHeaders = (response: Response, pathname: string): Response => {
  const headers = new Headers(response.headers)
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(name, value)
  }
  if (pathname.startsWith('/assets/')) {
    headers.set('cache-control', IMMUTABLE_CACHE_CONTROL)
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

/**
 * Sites requires a Worker entry point. Static files are served asset-first;
 * this fallback preserves the same SPA behavior for requests reaching Worker.
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === '/api/news') {
      return withSecurityHeaders(await handleNewsRequest(request), url.pathname)
    }

    const response = await env.ASSETS.fetch(request)
    const acceptsHtml = request.headers.get('accept')?.includes('text/html') ?? false
    const isNavigation = request.headers.get('sec-fetch-mode') === 'navigate'

    if (request.method === 'GET' && response.status === 404 && (acceptsHtml || isNavigation)) {
      const indexUrl = new URL(request.url)
      indexUrl.pathname = '/index.html'
      const fallback = await env.ASSETS.fetch(new Request(indexUrl, request))
      return withSecurityHeaders(fallback, indexUrl.pathname)
    }

    return withSecurityHeaders(response, url.pathname)
  },
}
