import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import Layout from '../../../components/Layout';

type Backend = 'auto' | 'groq' | 'ollama';

type InferState = 'idle' | 'running' | 'error' | 'done';

const DEFAULT_INVOICE_SCHEMA = {
  id: 'invoice.v1',
  name: 'Invoice v1',
  version: '1.0.0',
  type: 'object',
  properties: {
    invoice_number: { type: 'string' },
    date: { type: 'string', format: 'date' },
    subtotal: { type: 'number' },
    tax: { type: 'number' },
    grand_total: { type: 'number' },
  },
  required: ['invoice_number', 'grand_total'],
};

type FieldType = 'string' | 'number' | 'integer' | 'boolean' | 'date' | 'array' | 'object';
type FieldRow = { name: string; type: FieldType; required: boolean };

const TEMPLATES: Array<{ id: string; name: string; version: string; fields: FieldRow[] }> = [
  {
    id: 'invoice.v1', name: 'Invoice v1', version: '1.0.0',
    fields: [
      { name: 'invoice_number', type: 'string', required: true },
      { name: 'date', type: 'date', required: false },
      { name: 'vendor', type: 'string', required: false },
      { name: 'customer', type: 'string', required: false },
      { name: 'subtotal', type: 'number', required: false },
      { name: 'tax', type: 'number', required: false },
      { name: 'grand_total', type: 'number', required: true },
      { name: 'currency', type: 'string', required: false },
      { name: 'due_date', type: 'date', required: false },
      { name: 'lines', type: 'array', required: false },
    ],
  },
  {
    id: 'receipt.v1', name: 'Receipt v1', version: '1.0.0',
    fields: [
      { name: 'merchant', type: 'string', required: false },
      { name: 'date', type: 'date', required: false },
      { name: 'total', type: 'number', required: true },
      { name: 'tax', type: 'number', required: false },
      { name: 'payment_method', type: 'string', required: false },
      { name: 'items', type: 'array', required: false },
    ],
  },
  {
    id: 'po.v1', name: 'Purchase Order v1', version: '1.0.0',
    fields: [
      { name: 'po_number', type: 'string', required: true },
      { name: 'date', type: 'date', required: false },
      { name: 'supplier', type: 'string', required: false },
      { name: 'buyer', type: 'string', required: false },
      { name: 'total', type: 'number', required: true },
      { name: 'items', type: 'array', required: false },
    ],
  },
  {
    id: 'bank_statement.v1', name: 'Bank Statement v1', version: '1.0.0',
    fields: [
      { name: 'account_holder', type: 'string', required: false },
      { name: 'account_number', type: 'string', required: false },
      { name: 'statement_period', type: 'string', required: false },
      { name: 'opening_balance', type: 'number', required: false },
      { name: 'closing_balance', type: 'number', required: false },
      { name: 'transactions', type: 'array', required: false },
    ],
  },
  {
    id: 'catalog.v1', name: 'Catalog v1', version: '1.0.0',
    fields: [
      { name: 'title', type: 'string', required: true },
      { name: 'sku', type: 'string', required: false },
      { name: 'price', type: 'number', required: false },
      { name: 'currency', type: 'string', required: false },
      { name: 'description', type: 'string', required: false },
      { name: 'categories', type: 'array', required: false },
    ],
  },
  {
    id: 'contract_clause.v1', name: 'Contract Clause v1', version: '1.0.0',
    fields: [
      { name: 'clause_id', type: 'string', required: false },
      { name: 'title', type: 'string', required: false },
      { name: 'effective_date', type: 'date', required: false },
      { name: 'parties', type: 'array', required: false },
      { name: 'jurisdiction', type: 'string', required: false },
      { name: 'clause_text', type: 'string', required: true },
    ],
  },
];

export default function FormatPage() {
  const router = useRouter();
  const { id } = router.query as { id?: string };

  const [backend, setBackend] = useState<Backend>('auto');
  const [activeSchemaId, setActiveSchemaId] = useState<string | null>(null);
  const [activeSchemaName, setActiveSchemaName] = useState<string | null>(null);
  const [schemaText, setSchemaText] = useState<string>(JSON.stringify(DEFAULT_INVOICE_SCHEMA, null, 2));
  const [schemaParseError, setSchemaParseError] = useState<string | null>(null);
  const [editorLines, setEditorLines] = useState<string[]>(() => JSON.stringify(DEFAULT_INVOICE_SCHEMA, null, 2).split('\n'));
  const [schemaMeta, setSchemaMeta] = useState<{ id?: string; name?: string; version?: string }>(() => ({ id: TEMPLATES[0].id, name: TEMPLATES[0].name, version: TEMPLATES[0].version }));
  const [fields, setFields] = useState<FieldRow[]>(() => [...TEMPLATES[0].fields]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>(TEMPLATES[0].id);
  const [saving, setSaving] = useState(false);
  const [activating, setActivating] = useState(false);
  const [running, setRunning] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [infState, setInfState] = useState<InferState>('idle');
  const [infError, setInfError] = useState<string | null>(null);

  const apiBase = useMemo(() => 'http://localhost:3001', []);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    async function loadActive() {
      try {
        const res = await fetch(`${apiBase}/projects/${id}`);
        const data = await res.json();
        if (cancelled) return;
        // Prefer AGENTS.md contract: active_schema_id
        if (data.active_schema_id) {
          setActiveSchemaId(data.active_schema_id);
          setActiveSchemaName(data.active_schema_id);
          return;
        }
        // Fallback to workflow-based API
        if (data.active_workflow_id) {
          const wf = await fetch(`${apiBase}/projects/${id}/workflows`).then(r => r.json());
          if (cancelled) return;
          const found = (wf.workflows || []).find((w: any) => w.id === data.active_workflow_id);
          if (found?.schema?.id) {
            setActiveSchemaId(found.schema.id);
            setActiveSchemaName(found.schema.name || found.schema.id);
          }
        }
      } catch {
        // ignore
      }
    }
    loadActive();
    return () => { cancelled = true; };
  }, [id, apiBase]);

  function buildJsonSchemaFromState() {
    const props: Record<string, any> = {};
    const req: string[] = [];
    for (const f of fields) {
      if (!f.name) continue;
      let prop: any;
      switch (f.type) {
        case 'date': prop = { type: 'string', format: 'date' }; break;
        case 'array': prop = { type: 'array' }; break;
        case 'object': prop = { type: 'object' }; break;
        default: prop = { type: f.type };
      }
      props[f.name] = prop;
      if (f.required) req.push(f.name);
    }
    const out: any = {
      id: schemaMeta.id || 'custom.v1',
      name: schemaMeta.name || (schemaMeta.id || 'Custom'),
      version: schemaMeta.version || '1.0.0',
      type: 'object',
      properties: props,
    };
    if (req.length) out.required = req;
    return out;
  }

  function applyDraftToState(draft: any) {
    try {
      const p = draft || {};
      setSchemaMeta({ id: p.id, name: p.name, version: p.version });
      const props = p.properties || {};
      const req: string[] = Array.isArray(p.required) ? p.required : [];
      const rows: FieldRow[] = Object.keys(props).map((k) => {
        const spec = props[k] || {};
        let t: FieldType = 'string';
        if (spec.type === 'array') t = 'array';
        else if (spec.type === 'object') t = 'object';
        else if (spec.type === 'integer') t = 'integer';
        else if (spec.type === 'number') t = 'number';
        else if (spec.type === 'boolean') t = 'boolean';
        else if (spec.type === 'string' && spec.format === 'date') t = 'date';
        else t = 'string';
        return { name: k, type: t, required: req.includes(k) };
      });
      setFields(rows);
    } catch { /* ignore bad drafts */ }
  }

  function applyTemplate(tid: string) {
    const t = TEMPLATES.find((x) => x.id === tid) || TEMPLATES[0];
    setSelectedTemplate(t.id);
    setSchemaMeta({ id: t.id, name: t.name, version: t.version });
    setFields([...t.fields]);
  }

  async function setActiveFormat(schemaId: string) {
    if (!id) return;
    // Try AGENTS contract first
    try {
      const r = await fetch(`${apiBase}/projects/${id}/format`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schema_id: schemaId })
      });
      if (r.ok) {
        setActiveSchemaId(schemaId);
        return true as const;
      }
    } catch { /* ignore and fallback */ }
    // Fallback: create + activate workflow
    try {
      const wfRes = await fetch(`${apiBase}/projects/${id}/workflows`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ schema_id: schemaId, backend })
      });
      const wf = await wfRes.json();
      if (!wfRes.ok) throw new Error(wf?.error || `HTTP ${wfRes.status}`);
      const act = await fetch(`${apiBase}/projects/${id}/workflows/${encodeURIComponent(wf.id)}/activate`, { method: 'PATCH' });
      if (!act.ok) {
        const d = await act.json().catch(() => ({}));
        throw new Error(d?.error || `HTTP ${act.status}`);
      }
      setActiveSchemaId(schemaId);
      return true as const;
    } catch (e: any) {
      alert(`Failed to set Active Format: ${e?.message || String(e)}`);
      return false as const;
    }
  }

  async function saveSchema(): Promise<boolean> {
    if (!id) return false;
    const parsed = buildJsonSchemaFromState();
    setSaving(true);
    try {
      // Try AGENTS contract: save schema and set as active
      try {
        const res = await fetch(`${apiBase}/projects/${id}/schemas`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ json_schema: parsed, name: parsed.name || parsed.id, version: parsed.version || '1.0.0', kind: 'user' })
        });
        const data = await res.json();
        if (res.ok && data?.id) {
          const ok = await setActiveFormat(data.id);
          if (ok) {
            setActiveSchemaName(parsed.name || parsed.id || data.id);
            return true;
          }
        }
      } catch { /* fall through to legacy */ }

      // Fallback legacy: use workflow create with inline schema_json
      const wfRes = await fetch(`${apiBase}/projects/${id}/workflows`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ schema_json: parsed, backend })
      });
      const wf = await wfRes.json();
      if (!wfRes.ok) throw new Error(wf?.error || `HTTP ${wfRes.status}`);
      const act = await fetch(`${apiBase}/projects/${id}/workflows/${encodeURIComponent(wf.id)}/activate`, { method: 'PATCH' });
      const actData = await act.json();
      if (!act.ok) throw new Error(actData?.error || `HTTP ${act.status}`);
      setActiveSchemaId(parsed.id || parsed.name || wf.id);
      setActiveSchemaName(parsed.name || parsed.id || wf.id);
      return true;
    } catch (e) {
      const msg = (e as any)?.message || String(e);
      alert(`Failed to save schema: ${msg}`);
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function inferSchema() {
    if (!id) return;
    setInfState('running');
    setInfError(null);
    try {
      const res = await fetch(`${apiBase}/projects/${id}/infer_schema`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      const draft = data?.schema || data?.json_schema || data;
      if (draft) applyDraftToState(draft);
      setInfState('done');
    } catch (e) {
      // Fallback: load default invoice schema
      applyTemplate('invoice.v1');
      setInfState('error');
      setInfError((e as any)?.message || 'Failed to infer; loaded default invoice schema.');
    }
  }

  async function runExtraction() {
    if (!id) return;
    // Ensure an active format exists
    if (!activeSchemaId) {
      const ok = await saveSchema();
      if (!ok) return; // saveSchema already alerts
    }
    setRunning(true);
    try {
      const res = await fetch(`${apiBase}/projects/${id}/extract`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        const err = data?.error || `HTTP ${res.status}`;
        if (err.includes('workflow_required') || err.includes('format_required')) {
          alert('Please save and activate a format first.');
        } else {
          alert(`Failed to start extraction: ${err}`);
        }
        setRunning(false);
        return;
      }
      setJobId(data.job_id);
    } catch (e) {
      const msg = (e as any)?.message || String(e);
      alert(`Failed to start extraction: ${msg}`);
      setRunning(false);
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
        const r = await fetch(`${apiBase}/jobs/${jobId}`, { cache: 'no-store', signal: controller.signal });
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
  }, [jobId, id, router, apiBase]);

  return (
    <Layout>
      <h1 className="page-title">Format</h1>
      <div className="page-sub">
        Selected Format: {activeSchemaId ? <code title={activeSchemaName || activeSchemaId}>{activeSchemaId}</code> : 'None'}
      </div>

      <div className="row">
        <div className="card card-pad col">
          <div className="section-title">Choose Format</div>
          <div className="row" style={{ marginBottom: 8, alignItems: 'center' }}>
            <select className="input" value={selectedTemplate} onChange={(e) => applyTemplate(e.target.value)}>
              {TEMPLATES.map(t => (
                <option value={t.id} key={t.id}>{t.name} ({t.id})</option>
              ))}
            </select>
            <button className="btn btn-primary" onClick={inferSchema} disabled={infState === 'running'}>{infState === 'running' ? 'Inferring…' : 'Infer Format'}</button>
            {infState === 'error' && (
              <span className="badge" style={{ color: 'var(--warn)' }}>{infError}</span>
            )}
          </div>

          <div className="section-title" style={{ marginBottom: 6 }}>Schema Meta</div>
          <div className="card card-pad" style={{ marginBottom: 12 }}>
            <div className="kv">
              <div>ID</div>
              <div><input className="mini-input" value={schemaMeta.id || ''} onChange={(e) => setSchemaMeta((m) => ({ ...m, id: e.target.value }))} /></div>
              <div>Name</div>
              <div><input className="mini-input" value={schemaMeta.name || ''} onChange={(e) => setSchemaMeta((m) => ({ ...m, name: e.target.value }))} /></div>
              <div>Version</div>
              <div><input className="mini-input" value={schemaMeta.version || ''} onChange={(e) => setSchemaMeta((m) => ({ ...m, version: e.target.value }))} /></div>
            </div>
          </div>

          <div className="section-title" style={{ marginBottom: 6 }}>Fields</div>
          <div className="fields-list">
            {fields.length === 0 ? (
              <div className="muted">No fields. Add your first field.</div>
            ) : fields.map((f, idx) => (
              <div className="field-row" key={`${f.name}-${idx}`}>
                <div className="row" style={{ alignItems: 'center' }}>
                  <input className="mini-input" placeholder="name" value={f.name} onChange={(e) => {
                    const v = e.target.value; setFields((arr) => arr.map((x, i) => i === idx ? { ...x, name: v } : x));
                  }} />
                  <select className="mini-input" value={f.type} onChange={(e) => {
                    const v = e.target.value as any; setFields((arr) => arr.map((x, i) => i === idx ? { ...x, type: v } : x));
                  }}>
                    {(['string','number','integer','boolean','date','array','object']).map((t) => (<option key={t} value={t}>{t}</option>))}
                  </select>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <input type="checkbox" checked={!!f.required} onChange={(e) => setFields((arr) => arr.map((x, i) => i === idx ? { ...x, required: e.target.checked } : x))} /> required
                  </label>
                </div>
                <div>
                  <button className="btn btn-ghost" onClick={() => setFields((arr) => arr.filter((_, i) => i !== idx))}>Delete</button>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 8 }}>
            <button className="btn btn-secondary" onClick={() => setFields((arr) => [...arr, { name: '', type: 'string', required: false }])}>Add Field</button>
          </div>
        </div>
        <div className="card card-pad col" style={{ maxWidth: 420 }}>
          <div className="section-title">Backend</div>
          <div className="grid">
            <label><input type="radio" name="backend" checked={backend === 'auto'} onChange={() => setBackend('auto')} /> Auto</label>
            <label><input type="radio" name="backend" checked={backend === 'groq'} onChange={() => setBackend('groq')} /> Groq</label>
            <label><input type="radio" name="backend" checked={backend === 'ollama'} onChange={() => setBackend('ollama')} /> Ollama</label>
          </div>
          <div style={{ height: 8 }} />
          <button className="btn btn-primary" onClick={saveSchema} disabled={saving || activating}>{saving ? 'Saving…' : 'Save schema & set Active'}</button>
          <div style={{ height: 8 }} />
          <button className="btn btn-secondary" onClick={runExtraction} disabled={running || saving || activating}>{running ? 'Running…' : 'Run Extraction'}</button>
        </div>
      </div>
    </Layout>
  );
}
