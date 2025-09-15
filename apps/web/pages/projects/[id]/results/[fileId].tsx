import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import Layout from '../../../../components/Layout';

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

export default function ResultViewer() {
  const router = useRouter();
  const { id, fileId } = router.query as { id?: string, fileId?: string };
  const [env, setEnv] = useState<any | null>(null);
  const [textData, setText] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !fileId) return;
    let cancelled = false;
    fetch(`http://localhost:3001/projects/${id}/results/${fileId}`).then(async (r) => {
      const body = await r.text();
      const data = (() => { try { return JSON.parse(body); } catch { return null; } })();
      if (!cancelled) {
        if (!r.ok) {
          setErr((data && data.error) ? `No result: ${data.error}` : 'No result.');
          setEnv(null);
        } else {
          setErr(null);
          setEnv(data);
        }
      }
    });
    fetch(`http://localhost:3001/projects/${id}/files/${fileId}/text`).then(async (r) => {
      const t = await r.text();
      if (!cancelled) setText(r.ok ? t : null);
    });
    return () => { cancelled = true; };
  }, [id, fileId]);

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
      <h1 className="page-title">Extraction Result</h1>
      {err && (
        <div className="badge" style={{ marginBottom: 12, color: 'var(--danger)' }}>{err}</div>
      )}
      {env ? (
        <div className="row">
          <div className="card card-pad" style={{ flex: '0 0 420px' }}>
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
                a.download = `result-${fileId}.json`;
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
          <div className="card card-pad" style={{ flex: 1 }}>
            <div className="section-title">Document Text</div>
            <div className="scroll mono">
              {textData ? highlight(textData, allSpans) : 'Loading text...'}
            </div>
          </div>
        </div>
      ) : (
        <div className="badge">Loading…</div>
      )}
    </Layout>
  );
}
