import Link from 'next/link';

export default function Home() {
  return (
    <main style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h1>LangExtract — Web</h1>
      <p>Upload, review, and manage workflow schemas.</p>
      <p>
        Health: <a href="/api/health">/api/health</a>
      </p>
      <p>
        Try ingest: <a href="/ingest">/ingest</a>
        {' | '}
        Jobs: <a href="/jobs">/jobs</a>
        {' | '}
        Documents: <a href="/docs">/docs</a>
      </p>
    </main>
  );
}
