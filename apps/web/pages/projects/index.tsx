import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Layout from '../../components/Layout';

export default function ProjectsPage() {
  const [creating, setCreating] = useState(false);
  const router = useRouter();

  const [name, setName] = useState('New Project');
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  async function createProject() {
    setCreating(true);
    try {
      const res = await fetch('http://localhost:3001/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
      const data = await res.json();
      if (data?.id) router.push(`/projects/${data.id}`);
    } finally {
      setCreating(false);
    }
  }

  async function loadProjects() {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:3001/projects');
      const data = await res.json();
      setProjects(Array.isArray(data) ? data : []);
    } catch {
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProjects();
  }, []);

  return (
    <Layout>
      <h1 className="page-title">Projects</h1>
      <div className="page-sub">Create a project to group related documents.</div>

      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <div className="row" style={{ alignItems: 'center' }}>
          <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Project name" />
          <button className="btn btn-primary" onClick={createProject} disabled={creating}>{creating ? 'Creating…' : 'Create Project'}</button>
        </div>
      </div>

      <div className="card card-pad">
        <div className="section-title">All Projects</div>
        {loading ? (
          <div className="badge">Loading…</div>
        ) : projects.length === 0 ? (
          <div className="page-sub">No projects yet.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Files</th>
                <th>Processed</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {projects.map(p => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{p.files_count ?? '-'}</td>
                  <td>{p.processed ?? '-'}</td>
                  <td>{p.created_at ? new Date(p.created_at).toLocaleString() : '-'}</td>
                  <td>
                    <a href={`/projects/${p.id}`}>Open</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Layout>
  );
}
