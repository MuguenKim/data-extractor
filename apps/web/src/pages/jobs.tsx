import { useEffect, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3001';

type JobItem = { id: string; status: string; created_at?: string | null; doc_id?: string | null; input_kind?: string | null };

export default function JobsListPage() {
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${API_BASE}/jobs`);
      const j = await r.json();
      setJobs(Array.isArray(j.jobs) ? j.jobs : []);
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
      <h1>Jobs</h1>
      <div style={{ marginBottom: 12 }}>
        <button onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
        {' '}
        <a href="/ingest">Upload</a>
        {' | '}
        <a href="/docs">Documents</a>
      </div>
      {error && <div style={{ color: 'crimson' }}>Error: {error}</div>}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #444' }}>Job ID</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #444' }}>Status</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #444' }}>Created</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #444' }}>Doc ID</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #444' }}>Input</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((j) => (
            <tr key={j.id}>
              <td><a href={`/jobs/${j.id}`}>{j.id}</a></td>
              <td>{j.status}</td>
              <td>{j.created_at || ''}</td>
              <td>{j.doc_id || ''}</td>
              <td>{j.input_kind || ''}</td>
            </tr>
          ))}
          {jobs.length === 0 && !loading && (
            <tr><td colSpan={5} style={{ color: '#777', paddingTop: 12 }}>No jobs yet.</td></tr>
          )}
        </tbody>
      </table>
    </main>
  );
}

