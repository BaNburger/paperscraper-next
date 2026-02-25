import { createFileRoute } from '@tanstack/react-router';
import { TRPC_PATH, getApiBaseUrl } from '../lib/api-client';

export const Route = createFileRoute('/')({
  component: HomePage,
});

function HomePage() {
  return (
    <main className="page">
      <section className="panel">
        <h1>PaperScraper Next</h1>
        <p>Foundation web shell is running.</p>
        <dl className="kv">
          <dt>API Base URL</dt>
          <dd>{getApiBaseUrl()}</dd>
          <dt>tRPC Path</dt>
          <dd>{TRPC_PATH}</dd>
        </dl>
      </section>
    </main>
  );
}
