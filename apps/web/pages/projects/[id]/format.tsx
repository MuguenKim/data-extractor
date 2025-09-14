import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

type Backend = 'auto' | 'groq' | 'ollama';

export default function FormatPage() {
  const router = useRouter();
  const { id } = router.query as { id?: string };

  const [backend, setBackend] = useState<Backend>('auto');
  const [schemaId, setSchemaId] = useState<string>('invoice.v1');
  const [workflow, setWorkflow] = useState<any | null>(null);
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [activeWorkflowId, setActiveWorkflowId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [activating, setActivating] = useState(false);
  const [running, setRunning] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);

  async function loadWorkflows() {
    if (!id) return;
    const res = await fetch(`http://localhost:3001/projects/${id}/workflows`);
    const data = await res.json();
    if (res.ok) {
      setWorkflows(data.workflows || []);
      setActiveWorkflowId(data.active_workflow_id || null);
    }
  }

  useEffect(() => { loadWorkflows(); }, [id]);

  async function saveWorkflow() {
    if (!id) return;
    setSaving(true);
    try {
      const res = await fetch(`http://localhost:3001/projects/${id}/workflows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schema_id: schemaId, backend })
      });
      const data = await res.json();
      if (res.ok) {
        setWorkflow(data);
        await activateWorkflow(data.id);
        await loadWorkflows();
      } else {
        alert(`Failed to save workflow: ${data?.error || res.status}`);
      }
    } finally {
      setSaving(false);
    }
  }

  async function activateWorkflow(wfId: string) {
    if (!id) return;
    setActivating(true);
    try {
      const res = await fetch(`http://localhost:3001/projects/${id}/workflows/${encodeURIComponent(wfId)}/activate`, { method: 'PATCH' });
      const data = await res.json();
      if (!res.ok) {
        alert(`Failed to activate workflow: ${data?.error || res.status}`);
        return;
      }
      setActiveWorkflowId(data.active_workflow_id || wfId);
    } finally {
      setActivating(false);
    }
  }

  async function runExtraction() {
    if (!id) return;
    // rely on Active Workflow
    if (!activeWorkflowId) {
      // Try creating + activating one automatically
      await saveWorkflow();
    }
    if (!activeWorkflowId && !workflow?.id) return;
    setRunning(true);
    try {
      const res = await fetch(`http://localhost:3001/projects/${id}/extract`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        if (data?.error === 'workflow_required') {
          alert('No Active Workflow set. Please create/activate a workflow.');
        } else {
          alert(`Failed to start extraction: ${data?.error || res.status}`);
        }
        setRunning(false);
        return;
      }
      setJobId(data.job_id);
    } finally {
      // keep running flag until job completes
    }
  }

  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    let t: any;
    async function poll() {
      const r = await fetch(`http://localhost:3001/jobs/${jobId}`);
      const d = await r.json();
      if (cancelled) return;
      if (d.status === 'done') {
        setRunning(false);
        setJobId(null);
        router.push(`/projects/${id}/extract`);
      } else if (d.status === 'failed') {
        setRunning(false);
        setJobId(null);
        alert(`Extraction failed: ${d.error || 'unknown error'}`);
      } else {
        t = setTimeout(poll, 800);
      }
    }
    poll();
    return () => { cancelled = true; if (t) clearTimeout(t); };
  }, [jobId, id, router]);

  return (
    <div style={{ padding: 20 }}>
      <h1>Choose Format & Backend</h1>
      <div style={{ marginBottom: 12, color: '#444' }}>
        Active Workflow: {activeWorkflowId ? <code>{activeWorkflowId}</code> : 'None'}
      </div>
      <div style={{ display: 'flex', gap: 24 }}>
        <div style={{ flex: 1 }}>
          <h3>Schema</h3>
          <label>
            <input type="radio" name="schema" checked={schemaId === 'invoice.v1'} onChange={() => setSchemaId('invoice.v1')} /> Invoice v1
          </label>
          {/* Future: Infer Schema flow */}
        </div>
        <div style={{ flex: 1 }}>
          <h3>Backend</h3>
          <div>
            <label><input type="radio" name="backend" checked={backend === 'auto'} onChange={() => setBackend('auto')} /> Auto</label>
          </div>
          <div>
            <label><input type="radio" name="backend" checked={backend === 'groq'} onChange={() => setBackend('groq')} /> Groq</label>
          </div>
          <div>
            <label><input type="radio" name="backend" checked={backend === 'ollama'} onChange={() => setBackend('ollama')} /> Ollama</label>
          </div>
          
        </div>
      </div>
      <div style={{ marginTop: 16, display: 'flex', gap: 12 }}>
        <button disabled={!id || saving || activating} onClick={saveWorkflow}>{saving ? 'Saving...' : (workflow ? 'Save + Activate' : 'Save + Activate')}</button>
        <button disabled={!id || running || activating || saving} onClick={runExtraction}>{running ? 'Running...' : 'Run Extraction'}</button>
      </div>
      {workflows?.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h3>Project Workflows</h3>
          <ul>
            {workflows.map((wf) => (
              <li key={wf.id}>
                <code>{wf.id}</code> — backend: {wf.backend}, schema: {wf.schema?.id}
                {activeWorkflowId !== wf.id && (
                  <button style={{ marginLeft: 8 }} disabled={activating} onClick={() => activateWorkflow(wf.id)}>
                    {activating ? 'Activating…' : 'Activate'}
                  </button>
                )}
                {activeWorkflowId === wf.id && <span style={{ marginLeft: 8, color: 'green' }}>(Active)</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
