import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

function highlight(text: string, spans: { start: number; end: number }[]) {
  if (!spans || spans.length === 0) return [text];
  const merged = [...spans].sort((a, b) => a.start - b.start);
  const parts: any[] = [];
  let idx = 0;
  for (const s of merged) {
    if (s.start > idx) parts.push(text.slice(idx, s.start));
    parts.push(<mark key={`${s.start}-${s.end}`} style={{ backgroundColor: '#fffd65' }}>{text.slice(s.start, s.end)}</mark>);
    idx = s.end;
  }
  if (idx < text.length) parts.push(text.slice(idx));
  return parts;
}

export default function ResultViewer() {
  const router = useRouter();
  const { id, fileId } = router.query as { id?: string, fileId?: string };
  const [meta, setMeta] = useState<any | null>(null);
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
          setMeta(null);
        } else {
          setErr(null);
          setMeta(data);
        }
      }
    });
    fetch(`http://localhost:3001/projects/${id}/files/${fileId}/text`).then(async (r) => {
      const t = await r.text();
      if (!cancelled) setText(r.ok ? t : null);
    });
    return () => { cancelled = true; };
  }, [id, fileId]);

  return (
    <div style={{ padding: 20 }}>
      <h1>Raw Text Result</h1>
      {err && (
        <div style={{ marginBottom: 12, color: '#a00' }}>
          {err}
        </div>
      )}
      {meta ? (
        <div>
          <div style={{ marginBottom: 8 }}>
            <strong>Pages:</strong> {meta.pages} &nbsp; <strong>Total Chars:</strong> {meta.total_chars}
          </div>
          <div style={{ whiteSpace: 'pre-wrap', border: '1px solid #ddd', padding: 12, borderRadius: 4, maxHeight: 600, overflow: 'auto' }}>
            {textData ?? 'Loading text...'}
          </div>
        </div>
      ) : (
        <div>Loading...</div>
      )}
    </div>
  );
}
