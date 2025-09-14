import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

type Workflow = { id: string; backend: string; schema: { id: string; title?: string; fields: any[] } };

export default function Workflows() {
  const [wf, setWf] = useState<Workflow | null>(null);
  const [text, setText] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [extracting, setExtracting] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("wfId");
    if (saved) {
      // no GET endpoint; store minimal info
      setWf({ id: saved, backend: "auto", schema: { id: "invoice.v1", fields: [] } });
    }
  }, []);

  async function createInvoiceWorkflow() {
    setCreating(true);
    try {
      const res = await fetch(`${API}/workflows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schema_id: 'invoice.v1', backend: 'mock' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setWf(data);
      localStorage.setItem("wfId", data.id);
    } catch (e) {
      alert(String(e));
    } finally {
      setCreating(false);
    }
  }

  async function runExtract() {
    if (!wf) return alert('Create a workflow first');
    setExtracting(true);
    try {
      const res = await fetch(`${API}/extract?workflow_id=${wf.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Extract failed');
      setJobId(data.job_id);
      window.location.href = `/jobs/${data.job_id}`;
    } catch (e) {
      alert(String(e));
    } finally {
      setExtracting(false);
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h1>Workflows</h1>
      <div style={{ marginBottom: 16 }}>
        <button onClick={createInvoiceWorkflow} disabled={creating}>
          {creating ? 'Creating…' : 'Create Invoice Workflow (invoice.v1)'}
        </button>
        {wf && (
          <span style={{ marginLeft: 12 }}>Workflow ID: <code>{wf.id}</code></span>
        )}
      </div>
      <h2>Try Extraction</h2>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste invoice text here"
        rows={12}
        style={{ width: '100%', fontFamily: 'monospace' }}
      />
      <div style={{ marginTop: 12 }}>
        <button onClick={runExtract} disabled={!wf || extracting}>
          {extracting ? 'Submitting…' : 'Extract'}
        </button>
      </div>
      {jobId && <p>Submitted job: {jobId}</p>}
    </main>
  );
}

