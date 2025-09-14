import { useEffect, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3001';

type DocItem = { id: string; adapter?: string | null; filename?: string | null; mime?: string | null; bytes?: number | null; pages?: number | null };

export default function DocsListPage() {
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${API_BASE}/docs`);
      const j = await r.json();
      setDocs(Array.isArray(j.docs) ? j.docs : []);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <main style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 1000 }}>
      <h1>Documents</h1>
      <div style={{ marginBottom: 12 }}>
        <button onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
        {' '}
        <a href="/ingest">Upload</a>
        {' | '}
        <a href="/jobs">Jobs</a>
      </div>
      {error && <div style={{ color: 'crimson' }}>Error: {error}</div>}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #444' }}>Doc ID</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #444' }}>Adapter</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #444' }}>Filename</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #444' }}>Mime</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #444' }}>Bytes</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #444' }}>Pages</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #444' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {docs.map((d) => (
            <tr key={d.id}>
              <td>{d.id}</td>
              <td>{d.adapter || ''}</td>
              <td>{d.filename || ''}</td>
              <td>{d.mime || ''}</td>
              <td>{d.bytes ?? ''}</td>
              <td>{d.pages ?? ''}</td>
              <td><a href={`${API_BASE}/docs/${d.id}/text`} target="_blank" rel="noreferrer">open</a></td>
            </tr>
          ))}
          {docs.length === 0 && !loading && (
            <tr><td colSpan={7} style={{ color: '#777', paddingTop: 12 }}>No documents yet.</td></tr>
          )}
        </tbody>
      </table>
    </main>
  );
}

