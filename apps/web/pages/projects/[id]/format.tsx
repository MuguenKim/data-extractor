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
    let delay = 900;
    const MAX_DELAY = 5000;
    const controller = new AbortController();
    const visible = () => typeof document !== 'undefined' ? !document.hidden : true;
    async function poll() {
      if (cancelled) return;
      try {
        const r = await fetch(`http://localhost:3001/jobs/${jobId}`, { cache: 'no-store', signal: controller.signal });
        const d = await r.json();
        if (cancelled) return;
        if (d.status === 'done') {
          setRunning(false);
          setJobId(null);
          router.push(`/projects/${id}/extract`);
          return;
        }
        if (d.status === 'failed') {
          setRunning(false);
          setJobId(null);
          alert(`Extraction failed: ${d.error || 'unknown error'}`);
          return;
        }
        delay = Math.min(Math.floor(delay * 1.7), MAX_DELAY);
        t = setTimeout(poll, visible() ? delay : MAX_DELAY);
      } catch (_e) {
        delay = Math.min(Math.floor((delay || 900) * 2), MAX_DELAY);
        if (!cancelled) t = setTimeout(poll, visible() ? delay : MAX_DELAY);
      }
    }
    const onVisibility = () => {
      if (visible()) {
        delay = 700;
        if (t) clearTimeout(t);
        t = setTimeout(poll, 10);
      }
    };
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility);
    poll();
    return () => {
      cancelled = true;
      if (t) clearTimeout(t);
      controller.abort();
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [jobId, id, router]);

  const activeWf = workflows.find((w) => w.id === activeWorkflowId);

  return (
    <div style={{ padding: 20 }}>
      <h1>Choose Format & Backend</h1>
      <div style={{ marginBottom: 12, color: '#444' }}>
        Active Format: {activeWf?.schema?.id ? <code>{activeWf.schema.id}</code> : 'None'}
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
        <button disabled={!id || saving || activating} onClick={saveWorkflow}>{saving ? 'Saving…' : 'Save Format'}</button>
        <button disabled={!id || running || activating || saving} onClick={runExtraction}>{running ? 'Running…' : 'Run Extraction'}</button>
      </div>
    </div>
  );
}
