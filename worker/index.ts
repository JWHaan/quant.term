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
  fetch(request: Request, env: Env): Promise<Response> {
    return env.ASSETS.fetch(request)
  },
}
