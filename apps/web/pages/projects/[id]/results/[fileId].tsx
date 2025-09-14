import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';

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
    <div style={{ padding: 20 }}>
      <h1>Extraction Result</h1>
      {err && (
        <div style={{ marginBottom: 12, color: '#a00' }}>{err}</div>
      )}
      {env ? (
        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{ flex: '0 0 360px' }}>
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
                a.download = `result-${fileId}.json`;
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
              {textData ? highlight(textData, allSpans) : 'Loading text...'}
            </div>
          </div>
        </div>
      ) : (
        <div>Loading...</div>
      )}
    </div>
  );
}
