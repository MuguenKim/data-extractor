import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

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
    <div style={{ padding: 20 }}>
      <h1>Projects</h1>
      <p>Create a new project to group similar documents.</p>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Project Name" />
        <button onClick={createProject} disabled={creating}>{creating ? 'Creating...' : 'Create Project'}</button>
      </div>
      <div style={{ marginTop: 16 }}>
        <h3>All Projects</h3>
        {loading ? (
          <div>Loading...</div>
        ) : projects.length === 0 ? (
          <div>No projects yet.</div>
        ) : (
          <table cellPadding={6} style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th align="left">Name</th>
                <th align="left">Files</th>
                <th align="left">Processed</th>
                <th align="left">Created</th>
                <th align="left">Actions</th>
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
    </div>
  );
}
