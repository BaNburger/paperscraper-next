import { createFileRoute } from '@tanstack/react-router';
import { getApiConfig } from '../lib/api-client';

export const Route = createFileRoute('/')({
  component: HomePage,
});

function HomePage() {
  const api = getApiConfig();

  return (
    <main className="page">
      <section className="panel">
        <h1>PaperScraper Next</h1>
        <p>Foundation web shell is running.</p>
        <dl className="kv">
          <dt>API Base URL</dt>
          <dd>{api.baseUrl}</dd>
          <dt>tRPC Path</dt>
          <dd>{api.trpcPath}</dd>
        </dl>
      </section>
    </main>
  );
}
