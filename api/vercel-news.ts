// Vercel emits this Function as native ESM, so the runtime import needs the
// JavaScript extension even though the source module is authored in TypeScript.
import { handleNewsRequest } from '../worker/news.js';

/** Vercel Function adapter for the platform-neutral news handler. */
export default {
    fetch(request: Request): Promise<Response> {
        return handleNewsRequest(request);
    },
};
