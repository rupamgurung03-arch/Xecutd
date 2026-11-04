import { onRequest } from './functions/api/[[path]].ts';

type WorkerEnv = Parameters<typeof onRequest>[0]['env'] & {
  ASSETS: { fetch(request: Request): Promise<Response> };
};

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const { pathname } = new URL(request.url);

    // Send API requests through the existing auth-checked Pages handler.
    if (pathname.startsWith('/api/')) {
      return onRequest({ request, env });
    }

    // The same Worker serves the built Vite app and SPA routes.
    return env.ASSETS.fetch(request);
  },
};
