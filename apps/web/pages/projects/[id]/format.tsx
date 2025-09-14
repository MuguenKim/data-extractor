import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

type Backend = 'auto' | 'groq' | 'ollama' | 'mock';

export default function FormatPage() {
  const router = useRouter();
  const { id } = router.query as { id?: string };

  const [backend, setBackend] = useState<Backend>('auto');
  const [schemaId, setSchemaId] = useState<string>('invoice.v1');
  const [workflow, setWorkflow] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);

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
      } else {
        alert(`Failed to save workflow: ${data?.error || res.status}`);
      }
    } finally {
      setSaving(false);
    }
  }

  async function runExtraction() {
    if (!id) return;
    let wf = workflow;
    if (!wf) {
      await saveWorkflow();
      wf = workflow;
    }
    wf = wf || workflow; // in case state delay
    const wfId = (wf && wf.id) ? wf.id : undefined;
    if (!wfId) return;
    setRunning(true);
    try {
      const res = await fetch(`http://localhost:3001/projects/${id}/extract?workflow_id=${encodeURIComponent(wfId)}`, {
        method: 'POST'
      });
      const data = await res.json();
      if (!res.ok) {
        alert(`Failed to start extraction: ${data?.error || res.status}`);
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
          <div>
            <label><input type="radio" name="backend" checked={backend === 'mock'} onChange={() => setBackend('mock')} /> Baseline (mock)</label>
          </div>
        </div>
      </div>
      <div style={{ marginTop: 16, display: 'flex', gap: 12 }}>
        <button disabled={!id || saving} onClick={saveWorkflow}>{saving ? 'Saving...' : (workflow ? 'Update Workflow' : 'Save Workflow')}</button>
        <button disabled={!id || running || (!workflow && saving)} onClick={runExtraction}>{running ? 'Running...' : 'Run Extraction'}</button>
      </div>
      {workflow && (
        <div style={{ marginTop: 12, color: '#555' }}>
          Saved workflow: <code>{workflow.id}</code> (backend: {workflow.backend}, schema: {workflow.schema?.id})
        </div>
      )}
    </div>
  );
}

