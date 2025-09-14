import { useRouter } from 'next/router';
import { useState } from 'react';

export default function ProjectsPage() {
  const [creating, setCreating] = useState(false);
  const router = useRouter();

  const [name, setName] = useState('New Project');

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

  return (
    <div style={{ padding: 20 }}>
      <h1>Projects</h1>
      <p>Create a new project to group similar documents.</p>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Project Name" />
        <button onClick={createProject} disabled={creating}>{creating ? 'Creating...' : 'Create Project'}</button>
      </div>
    </div>
  );
}
