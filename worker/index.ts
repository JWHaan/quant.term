interface AssetsBinding {
  fetch(request: Request): Promise<Response>
}

interface Env {
  ASSETS: AssetsBinding
}

/**
 * Sites requires a Worker entry point. Static files are served asset-first;
 * this fallback preserves the same SPA behavior for requests reaching Worker.
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const response = await env.ASSETS.fetch(request)
    const acceptsHtml = request.headers.get('accept')?.includes('text/html') ?? false
    const isNavigation = request.headers.get('sec-fetch-mode') === 'navigate'

    if (request.method === 'GET' && response.status === 404 && (acceptsHtml || isNavigation)) {
      const indexUrl = new URL(request.url)
      indexUrl.pathname = '/index.html'
      return env.ASSETS.fetch(new Request(indexUrl, request))
    }

    return response
  },
}
