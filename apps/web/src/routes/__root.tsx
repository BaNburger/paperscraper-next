import { useEffect, useState, type ReactNode } from 'react';
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
import { Button } from '../components/ui/button';

const THEME_KEY = 'psn.theme';

export const Route = createRootRouteWithContext<AppRouterContext>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'PaperScraper Next' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  notFoundComponent: NotFoundRoute,
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
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') {
      return 'light';
    }
    return window.localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    window.localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen">
        <header className="sticky top-0 z-50 border-b border-border/80 bg-background/82 backdrop-blur">
          <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3 px-4 py-3 md:px-6">
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                PSN
              </div>
              <div>
                <div className="text-sm font-semibold tracking-wide">PaperScraper Next</div>
                <div className="hidden text-xs text-muted-foreground sm:block">Focus-first research workflow</div>
              </div>
            </div>
            <nav
              aria-label="Primary"
              className="grid grid-cols-2 rounded-lg border border-border/80 bg-card/90 p-1 text-sm"
            >
              <Link
                to="/feed"
                className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-accent/65 hover:text-foreground"
                activeProps={{ className: 'rounded-md bg-accent px-3 py-1.5 text-foreground shadow-sm' }}
              >
                Feed
              </Link>
              <Link
                to="/pipeline"
                className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-accent/65 hover:text-foreground"
                activeProps={{ className: 'rounded-md bg-accent px-3 py-1.5 text-foreground shadow-sm' }}
              >
                Pipeline
              </Link>
            </nav>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setTheme((current) => (current === 'light' ? 'dark' : 'light'))}
              aria-label="Toggle color theme"
            >
              {theme === 'light' ? 'Dark' : 'Light'}
            </Button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1400px] px-4 py-4 md:px-6 md:py-6">
          <Outlet />
        </main>
      </div>
    </QueryClientProvider>
  );
}

function NotFoundRoute() {
  return (
    <div className="rounded-xl border border-border bg-card/90 p-6 text-sm">
      <p className="mb-3 text-muted-foreground">This page does not exist.</p>
      <Link to="/feed" className="font-medium text-primary">
        Go to Feed
      </Link>
    </div>
  );
}
