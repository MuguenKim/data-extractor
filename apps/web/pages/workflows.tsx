import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

type WorkflowRow = { id: string; backend: string; schema: { id: string }; project_ids: string[] };

export default function Workflows() {
  const [list, setList] = useState<WorkflowRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/workflows`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setList(data || []);
    } catch (e: any) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <main style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h1>Workflows</h1>
      {loading && <p>Loading…</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: 12 }}>
        <thead>
          <tr>
            <th align="left">ID</th>
            <th align="left">Backend</th>
            <th align="left">Schema</th>
            <th align="left">Projects</th>
          </tr>
        </thead>
        <tbody>
          {list.map((w) => (
            <tr key={w.id}>
              <td style={{ borderBottom: '1px solid #eee', padding: '6px 4px' }}><code>{w.id}</code></td>
              <td style={{ borderBottom: '1px solid #eee', padding: '6px 4px' }}>{w.backend}</td>
              <td style={{ borderBottom: '1px solid #eee', padding: '6px 4px' }}><code>{w.schema?.id}</code></td>
              <td style={{ borderBottom: '1px solid #eee', padding: '6px 4px' }}>{w.project_ids?.length ? w.project_ids.join(', ') : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 12 }}>
        <button onClick={load}>Refresh</button>
      </div>
    </main>
  );
}

