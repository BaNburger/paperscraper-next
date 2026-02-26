import { createRouter as createTanStackRouter } from '@tanstack/react-router';
import { getQueryClient } from './lib/query-client';
import { routeTree } from './routeTree.gen';

export function getRouter() {
  return createTanStackRouter({
    routeTree,
    context: {
      queryClient: getQueryClient(),
    },
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
