import { useEffect, useState } from "react";
import Layout from "../components/Layout";

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
    <Layout>
      <h1 className="page-title">Workflows</h1>
      {loading && <div className="badge">Loading…</div>}
      {error && <div className="badge" style={{ color: 'var(--danger)' }}>{error}</div>}
      <div className="card card-pad">
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Backend</th>
              <th>Schema</th>
              <th>Projects</th>
            </tr>
          </thead>
          <tbody>
            {list.map((w) => (
              <tr key={w.id}>
                <td><code>{w.id}</code></td>
                <td>{w.backend}</td>
                <td><code>{w.schema?.id}</code></td>
                <td>{w.project_ids?.length ? w.project_ids.join(', ') : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginTop: 12 }}>
          <button className="btn btn-secondary" onClick={load}>Refresh</button>
        </div>
      </div>
    </Layout>
  );
}

