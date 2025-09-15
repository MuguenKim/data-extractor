import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import Layout from '../../../components/Layout';

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
    <Layout>
      <h1 className="page-title">Ingest Files</h1>

      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <div className="row" style={{ alignItems: 'center' }}>
          <div className="badge">Upload Method</div>
          <label><input type="radio" name="mode" checked={mode==='text'} onChange={() => setMode('text')} /> Text</label>
          <label><input type="radio" name="mode" checked={mode==='files'} onChange={() => setMode('files')} /> File(s)</label>
          <label><input type="radio" name="mode" checked={mode==='url'} onChange={() => setMode('url')} /> URL</label>
        </div>
        <div style={{ height: 8 }} />
        {mode === 'text' && (
          <div className="grid" style={{ gridTemplateColumns: '240px 1fr auto', alignItems: 'center' }}>
            <input className="input" placeholder="Filename e.g. sample.txt" value={name} onChange={e => setName(e.target.value)} />
            <textarea className="textarea" value={text} onChange={e => setText(e.target.value)} rows={8} />
            <button className="btn btn-primary" onClick={submitText} disabled={submitting || !id}>{submitting ? 'Uploading…' : 'Upload Text'}</button>
          </div>
        )}

        {mode === 'files' && (
          <div className="row">
            <input className="input" type="file" multiple onChange={e => setLocalFiles(Array.from(e.target.files || []))} />
            <button className="btn btn-primary" onClick={submitFiles} disabled={submitting || !id || localFiles.length === 0}>{submitting ? 'Uploading…' : `Upload ${localFiles.length || ''} File(s)`}</button>
          </div>
        )}

        {mode === 'url' && (
          <div className="row">
            <input className="input" placeholder="https://example.com/page" value={url} onChange={e => setUrl(e.target.value)} />
            <button className="btn btn-primary" onClick={submitUrl} disabled={submitting || !id || !url.trim()}>{submitting ? 'Fetching…' : 'Ingest URL'}</button>
          </div>
        )}
        {jobId && <div style={{ marginTop: 8 }} className="badge">Job: {jobId} (processing)</div>}
      </div>

      <div className="split">
        <div className="card card-pad">
          <div className="section-title">Files</div>
          <table className="table">
            <thead><tr><th>Name</th><th>Status</th><th>Pages</th><th>Action</th></tr></thead>
            <tbody>
              {files.map(f => (
                <tr key={f.id} style={{ background: selectedFileId===f.id ? '#f8fbff' : undefined }}>
                  <td style={{ wordBreak: 'break-all' }}>{f.name}</td>
                  <td className={f.status==='processed' ? 'status-ok' : ''}>{f.status}</td>
                  <td>{f.pages}</td>
                  <td>
                    <button className="btn btn-secondary" onClick={() => previewFile(f.id)}>Preview</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="section-title">Parsed Preview</div>
          {!selectedFileId && <div className="page-sub">Select a file to preview parsed text.</div>}
          {selectedFileId && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div className="page-sub">File ID: <code>{selectedFileId}</code></div>
              <div className="scroll mono" style={{ flex: 1, minHeight: 300 }}>
                {previewLoading ? 'Loading…' : previewText}
              </div>
              <div style={{ marginTop: 8 }}>
                <a className="btn btn-secondary" href={`/projects/${id}/results/${selectedFileId}`} target="_blank" rel="noreferrer">Open Result Page</a>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
