import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';

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
        if (data?.error === 'workflow_required') {
          router.push(`/projects/${id}/format`);
          return;
        }
        setError(data?.error || `HTTP ${res.status}`);
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
    <div style={{ padding: 20 }}>
      <h1>Structured Extraction</h1>
      <p>Run extraction across all processed files and review structured results alongside the source text.</p>
      <div style={{ marginTop: 8 }}>
        <button onClick={startExtraction} disabled={running}>{running ? 'Running…' : 'Run Extraction'}</button>
        {error && <span style={{ color: 'red', marginLeft: 12 }}>{error}</span>}
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
        <div style={{ flex: '0 0 300px' }}>
          <h3>Files</h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {(Array.isArray(summaries) ? summaries : []).map((s) => (
              <li key={s.file_id} style={{ padding: '6px 4px', borderBottom: '1px solid #eee', cursor: 'pointer', background: selectedFileId === s.file_id ? '#f6f8fa' : 'transparent' }}
                  onClick={() => setSelectedFileId(s.file_id)}>
                <div style={{ fontFamily: 'monospace' }}>{s.file_id.slice(0, 8)}…</div>
                <div style={{ fontSize: 12, color: s.status === 'ok' ? 'green' : '#555' }}>status: {s.status}</div>
              </li>
            ))}
          </ul>
        </div>
        <div style={{ flex: 1 }}>
          {env ? (
            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ flex: '0 0 380px' }}>
                <h3>Fields</h3>
                <table cellPadding={4} style={{ borderCollapse: 'collapse' }}>
                  <thead><tr><th align="left">Name</th><th align="left">Value</th><th>Conf</th></tr></thead>
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
                  <button onClick={() => {
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
                  <div style={{ marginTop: 8, color: '#a67c00' }}>
                    Warnings: {env.warnings.join(', ')}
                  </div>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <h3>Document Text</h3>
                <div style={{ whiteSpace: 'pre-wrap', border: '1px solid #ddd', padding: 12, borderRadius: 4, maxHeight: 600, overflow: 'auto' }}>
                  {docText ? highlight(docText, allSpans) : 'Loading text...'}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ color: '#555' }}>
              {selectedFileId ? 'Loading result…' : 'Select a file to view the extracted data.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
