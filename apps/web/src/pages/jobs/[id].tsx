import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3001';

type Job = { id: string; status: string; result?: any; doc_id?: string };
type DocText = { doc_id: string; text: string; pageMap: Array<{ page: number; start: number; end: number }>; meta?: any; warnings?: string[] };

export default function JobViewerPage() {
  const router = useRouter();
  const { id } = router.query;
  const [job, setJob] = useState<Job | null>(null);
  const [doc, setDoc] = useState<DocText | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!id || typeof id !== 'string') return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${API_BASE}/jobs/${id}`);
      const j = await r.json();
      setJob(j);
      const docId = j.doc_id || j.result?.document?.doc_id || j.result?.doc_id;
      if (docId) {
        const rd = await fetch(`${API_BASE}/docs/${docId}/text`);
        if (rd.ok) setDoc(await rd.json());
      }
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [id]);

  return (
    <main style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 1000 }}>
      <h1>Job {id}</h1>
      <div style={{ marginBottom: 12 }}>
        <a href="/jobs">Back to Jobs</a>
        {' | '}
        <a href="/docs">Documents</a>
        {' | '}
        <button onClick={load} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</button>
      </div>
      {error && <div style={{ color: 'crimson' }}>Error: {error}</div>}
      <section style={{ marginTop: 12 }}>
        <h3>Job Status</h3>
        <pre style={{ background: '#111', color: '#0f0', padding: 12, overflowX: 'auto' }}>{JSON.stringify(job, null, 2)}</pre>
      </section>
      {doc && (
        <section style={{ marginTop: 12 }}>
          <h3>Document</h3>
          <div>Adapter: <code>{doc.meta?.adapter}</code> | File: <code>{doc.meta?.filename}</code> | Mime: <code>{doc.meta?.mime}</code></div>
          <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
            <div style={{ width: '60%' }}>
              <h4>Text</h4>
              <pre style={{ background: '#111', color: '#ddd', padding: 12, height: 400, overflow: 'auto' }}>{doc.text}</pre>
            </div>
            <div style={{ width: '40%' }}>
              <h4>Page Map</h4>
              <pre style={{ background: '#111', color: '#ddd', padding: 12, height: 400, overflow: 'auto' }}>{JSON.stringify(doc.pageMap, null, 2)}</pre>
              {Array.isArray(doc.warnings) && doc.warnings.length > 0 && (
                <>
                  <h4>Warnings</h4>
                  <ul>
                    {doc.warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </>
              )}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}

