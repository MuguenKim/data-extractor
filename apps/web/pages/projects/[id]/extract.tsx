import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import Layout from '../../../components/Layout';

interface FileSummary { file_id: string; status: string }

function highlight(text: string, spans: { start: number; end: number }[]) {
  if (!spans || spans.length === 0) return [text];
  const merged = [...spans].sort((a, b) => a.start - b.start);
  const parts: any[] = [];
  let idx = 0;
  for (const s of merged) {
    const start = Math.max(0, Math.min(text.length, s.start));
    const end = Math.max(start, Math.min(text.length, s.end));
    if (start > idx) parts.push(text.slice(idx, start));
    parts.push(<mark key={`${start}-${end}`} style={{ backgroundColor: '#fffd65' }}>{text.slice(start, end)}</mark>);
    idx = end;
  }
  if (idx < text.length) parts.push(text.slice(idx));
  return parts;
}

export default function ExtractPage() {
  const router = useRouter();
  const { id } = router.query as { id?: string };
  const [summaries, setSummaries] = useState<FileSummary[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [env, setEnv] = useState<any | null>(null);
  const [docText, setDocText] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refreshResults() {
    if (!id) return;
    try {
      const res = await fetch(`http://localhost:3001/projects/${id}/results`);
      const text = await res.text();
      let data: any = [];
      try { data = JSON.parse(text); } catch { data = []; }
      const list: FileSummary[] = Array.isArray(data) ? data : [];
      setSummaries(list);
      const ok = list.filter((x: FileSummary) => x.status === 'ok');
      if (!selectedFileId && ok.length > 0) setSelectedFileId(ok[0].file_id);
    } catch {
      setSummaries([]);
    }
  }

  async function loadResult(fileId: string) {
    if (!id || !fileId) return;
    setEnv(null);
    setDocText(null);
    const r = await fetch(`http://localhost:3001/projects/${id}/results/${fileId}`);
    if (r.ok) setEnv(await r.json());
    const t = await fetch(`http://localhost:3001/projects/${id}/files/${fileId}/text`);
    setDocText(t.ok ? await t.text() : null);
  }

  async function startExtraction() {
    if (!id) return;
    setRunning(true);
    setError(null);
    try {
      const res = await fetch(`http://localhost:3001/projects/${id}/extract`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        const err = data?.error || `HTTP ${res.status}`;
        if (String(err).includes('workflow_required') || String(err).includes('format_required')) {
          router.push(`/projects/${id}/format`);
          return;
        }
        setError(err);
        setRunning(false);
        return;
      }
      setJobId(data.job_id);
    } catch (e: any) {
      setError(String(e));
      setRunning(false);
    }
  }

  useEffect(() => { refreshResults(); }, [id]);
  useEffect(() => { if (id && selectedFileId) loadResult(selectedFileId); }, [id, selectedFileId]);

  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    let t: any;
    let delay = 1000;
    const MAX_DELAY = 5000;
    const controller = new AbortController();
    const visible = () => typeof document !== 'undefined' ? !document.hidden : true;

    async function poll() {
      if (cancelled) return;
      try {
        const r = await fetch(`http://localhost:3001/jobs/${jobId}` , { cache: 'no-store', signal: controller.signal });
        const d = await r.json();
        if (cancelled) return;
        if (d.status === 'done') {
          setRunning(false);
          setJobId(null);
          refreshResults();
          return;
        }
        if (d.status === 'failed') {
          setRunning(false);
          setJobId(null);
          setError(d.error || 'unknown error');
          return;
        }
        // still processing
        delay = Math.min(Math.floor(delay * 1.7), MAX_DELAY);
        t = setTimeout(poll, visible() ? delay : MAX_DELAY);
      } catch (_e) {
        // back off a bit more on errors
        delay = Math.min(Math.floor((delay || 1000) * 2), MAX_DELAY);
        if (!cancelled) t = setTimeout(poll, visible() ? delay : MAX_DELAY);
      }
    }

    const onVisibility = () => {
      if (!jobId) return;
      if (visible()) {
        // when user returns, resume quickly
        delay = 800;
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
  }, [jobId]);

  const allSpans = useMemo(() => {
    if (!env) return [] as { start: number; end: number }[];
    const spans: { start: number; end: number }[] = [];
    for (const k of Object.keys(env.fields || {})) {
      const fr = env.fields[k];
      if (fr?.spans && Array.isArray(fr.spans)) spans.push(...fr.spans);
    }
    return spans;
  }, [env]);

  return (
    <Layout>
      <h1 className="page-title">Structured Extraction</h1>
      <div className="page-sub">Run extraction across all processed files and review results alongside the source text.</div>
      <div className="row" style={{ marginBottom: 12 }}>
        <button className="btn btn-primary" onClick={startExtraction} disabled={running}>{running ? 'Running…' : 'Run Extraction'}</button>
        {error && <span className="badge" style={{ color: 'var(--danger)' }}>{error}</span>}
      </div>
      <div className="row">
        <div className="card card-pad" style={{ flex: '0 0 300px' }}>
          <div className="section-title">Files</div>
          <ul className="list-reset">
            {(Array.isArray(summaries) ? summaries : []).map((s) => (
              <li key={s.file_id} className={`file-item ${selectedFileId === s.file_id ? 'active' : ''}`} onClick={() => setSelectedFileId(s.file_id)}>
                <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' }}>{s.file_id.slice(0, 8)}…</div>
                <div className={s.status === 'ok' ? 'status-ok' : 'status-warn'}>{s.status}</div>
              </li>
            ))}
          </ul>
        </div>
        <div className="card card-pad" style={{ flex: 1 }}>
          {env ? (
            <div className="row">
              <div style={{ flex: '0 0 420px' }}>
                <div className="section-title">Fields</div>
                <table className="table">
                  <thead><tr><th>Name</th><th>Value</th><th>Conf</th></tr></thead>
                  <tbody>
                    {Object.keys(env.fields || {}).map((k) => {
                      const fr = env.fields[k];
                      return (
                        <tr key={k}>
                          <td style={{ fontWeight: 600 }}>{k}</td>
                          <td>{String(fr?.value ?? '')}</td>
                          <td style={{ textAlign: 'right' }}>{(fr?.confidence ?? 0).toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div style={{ marginTop: 8 }}>
                  <button className="btn btn-secondary" onClick={() => {
                    const blob = new Blob([JSON.stringify(env, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `result-${selectedFileId}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}>Download JSON</button>
                </div>
                {env.warnings && env.warnings.length > 0 && (
                  <div style={{ marginTop: 8, color: 'var(--warn)' }}>
                    Warnings: {env.warnings.join(', ')}
                  </div>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <div className="section-title">Document Text</div>
                <div className="scroll mono">
                  {docText ? highlight(docText, allSpans) : 'Loading text...'}
                </div>
              </div>
            </div>
          ) : (
            <div className="page-sub">
              {selectedFileId ? 'Loading result…' : 'Select a file to view the extracted data.'}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
