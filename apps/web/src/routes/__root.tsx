import type { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router';
import type { AppRouterContext } from '../lib/query-client';
import appCss from '../styles.css?url';

export const Route = createRootRouteWithContext<AppRouterContext>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'PaperScraper Next' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  shellComponent: RootDocument,
  component: RootLayout,
});

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootLayout() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <div className="app-frame">
        <header className="app-header">
          <div className="brand">PaperScraper Next</div>
          <nav className="top-nav" aria-label="Primary">
            <Link to="/feed" activeProps={{ className: 'nav-active' }}>
              Feed
            </Link>
            <Link to="/pipeline" activeProps={{ className: 'nav-active' }}>
              Pipeline Board
            </Link>
          </nav>
        </header>
        <main className="app-main">
          <Outlet />
        </main>
      </div>
    </QueryClientProvider>
  );
}
