import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';

interface FileRec { id: string; name: string; status: string; pages: number; mime: string }

async function fileToBase64(f: File): Promise<string> {
  const buf = await f.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  // btoa is safe for binary strings
  return btoa(binary);
}

type UploadMode = 'text' | 'files' | 'url';

export default function IngestPage() {
  const router = useRouter();
  const { id } = router.query as { id?: string };
  const [mode, setMode] = useState<UploadMode>('text');
  const [name, setName] = useState('sample.txt');
  const [text, setText] = useState('Invoice No: INV-2025-003\nDate: 2025-09-01\nSubtotal: 100.00\nVAT: 20.00\nTotal: 120.00');
  const [submitting, setSubmitting] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [files, setFiles] = useState<FileRec[]>([]);
  const [localFiles, setLocalFiles] = useState<File[]>([]);
  const [url, setUrl] = useState('');
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [previewText, setPreviewText] = useState<string>('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const apiBase = useMemo(() => 'http://localhost:3001', []);

  async function submitText() {
    if (!id) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${apiBase}/projects/${id}/files`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, mime: 'text/plain', text }) });
      const data = await res.json();
      setJobId(data?.job_id || null);
    } finally {
      setSubmitting(false);
    }
  }

  async function submitFiles() {
    if (!id || localFiles.length === 0) return;
    setSubmitting(true);
    try {
      const filesPayload = await Promise.all(localFiles.map(async (f) => ({ name: f.name, mime: f.type || 'application/octet-stream', data_base64: await fileToBase64(f) })));
      const res = await fetch(`${apiBase}/projects/${id}/files`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ files: filesPayload }) });
      const data = await res.json();
      setJobId(data?.job_id || null);
    } finally {
      setSubmitting(false);
    }
  }

  async function submitUrl() {
    if (!id || !url.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${apiBase}/projects/${id}/files`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
      const data = await res.json();
      setJobId(data?.job_id || null);
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    if (!jobId) return;
    let t: any;
    let cancelled = false;
    let delay = 900;
    const MAX_DELAY = 5000;
    const controller = new AbortController();
    const visible = () => typeof document !== 'undefined' ? !document.hidden : true;

    async function poll() {
      if (!jobId || cancelled) return;
      try {
        const r = await fetch(`${apiBase}/jobs/${jobId}`, { cache: 'no-store', signal: controller.signal });
        const d = await r.json();
        if (cancelled) return;
        if (d.status === 'done' || d.status === 'failed') {
          setJobId(null);
          refreshFiles();
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
  }, [jobId]);

  async function refreshFiles() {
    if (!id) return;
    const res = await fetch(`${apiBase}/projects/${id}/files`);
    const data = await res.json();
    setFiles(data || []);
  }

  useEffect(() => { refreshFiles(); }, [id]);

  async function previewFile(fileId: string) {
    if (!id) return;
    setSelectedFileId(fileId);
    setPreviewLoading(true);
    setPreviewText('');
    try {
      const r = await fetch(`${apiBase}/projects/${id}/files/${fileId}/text`);
      const t = await r.text();
      setPreviewText(t || '(no text)');
    } catch (e) {
      setPreviewText('(failed to load text)');
    } finally {
      setPreviewLoading(false);
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Ingest Files</h1>

      <div style={{ marginBottom: 12 }}>
        <strong>Choose Upload Method:&nbsp;</strong>
        <label style={{ marginRight: 12 }}>
          <input type="radio" name="mode" checked={mode==='text'} onChange={() => setMode('text')} /> Text
        </label>
        <label style={{ marginRight: 12 }}>
          <input type="radio" name="mode" checked={mode==='files'} onChange={() => setMode('files')} /> File(s)
        </label>
        <label>
          <input type="radio" name="mode" checked={mode==='url'} onChange={() => setMode('url')} /> URL
        </label>
      </div>

      {/* Uploader area */}
      <div style={{ border: '1px solid #ddd', borderRadius: 6, padding: 12, marginBottom: 16 }}>
        {mode === 'text' && (
          <div>
            <div>
              <label>Filename:&nbsp;</label>
              <input value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div style={{ marginTop: 8 }}>
              <label>Text content:</label>
              <textarea value={text} onChange={e => setText(e.target.value)} rows={8} style={{ width: '100%' }} />
            </div>
            <button onClick={submitText} disabled={submitting || !id}>{submitting ? 'Uploading...' : 'Upload Text'}</button>
          </div>
        )}

        {mode === 'files' && (
          <div>
            <input type="file" multiple onChange={e => setLocalFiles(Array.from(e.target.files || []))} />
            <div style={{ marginTop: 8 }}>
              <button onClick={submitFiles} disabled={submitting || !id || localFiles.length === 0}>{submitting ? 'Uploading...' : `Upload ${localFiles.length || ''} File(s)`}</button>
            </div>
          </div>
        )}

        {mode === 'url' && (
          <div>
            <input placeholder="https://example.com/page" value={url} onChange={e => setUrl(e.target.value)} style={{ width: '100%' }} />
            <div style={{ marginTop: 8 }}>
              <button onClick={submitUrl} disabled={submitting || !id || !url.trim()}>{submitting ? 'Fetching...' : 'Ingest URL'}</button>
            </div>
          </div>
        )}
        {jobId && <div style={{ marginTop: 8 }}>Job: {jobId} (processing)</div>}
      </div>

      {/* Two-panel area: left list, right preview */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 16, alignItems: 'stretch' }}>
        <div style={{ border: '1px solid #eee', borderRadius: 6, padding: 12, overflow: 'auto' }}>
          <h3 style={{ marginTop: 0 }}>Files</h3>
          <table cellPadding={6} style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={{textAlign:'left'}}>Name</th><th>Status</th><th>Pages</th><th>Action</th></tr></thead>
            <tbody>
              {files.map(f => (
                <tr key={f.id} style={{ background: selectedFileId===f.id ? '#f7faff' : undefined }}>
                  <td style={{ wordBreak: 'break-all' }}>{f.name}</td>
                  <td>{f.status}</td>
                  <td>{f.pages}</td>
                  <td>
                    <button onClick={() => previewFile(f.id)}>Preview Parsed</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ border: '1px solid #eee', borderRadius: 6, padding: 12, display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ marginTop: 0 }}>Parsed Preview</h3>
          {!selectedFileId && <div style={{ color: '#666' }}>Select a file to preview parsed text.</div>}
          {selectedFileId && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{ marginBottom: 8, color: '#666' }}>File ID: {selectedFileId}</div>
              <div style={{ flex: 1, minHeight: 300, border: '1px solid #ddd', borderRadius: 4, background: '#fafafa', padding: 8, overflow: 'auto', whiteSpace: 'pre-wrap', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' }}>
                {previewLoading ? 'Loading…' : previewText}
              </div>
              <div style={{ marginTop: 8 }}>
                <a href={`/projects/${id}/results/${selectedFileId}`} target="_blank" rel="noreferrer">Open Structured Result page</a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
