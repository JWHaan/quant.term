import { handleNewsRequest } from '../worker/news';

/** Vercel Function adapter for the platform-neutral news handler. */
export default {
    fetch(request: Request): Promise<Response> {
        return handleNewsRequest(request);
    },
};
