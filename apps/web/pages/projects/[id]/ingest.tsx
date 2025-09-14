import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

interface FileRec { id: string; name: string; status: string; pages: number; mime: string }

async function fileToBase64(f: File): Promise<string> {
  const buf = await f.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  // btoa is safe for binary strings
  return btoa(binary);
}

export default function IngestPage() {
  const router = useRouter();
  const { id } = router.query as { id?: string };
  const [name, setName] = useState('sample.txt');
  const [text, setText] = useState('Invoice No: INV-2025-003\nDate: 2025-09-01\nSubtotal: 100.00\nVAT: 20.00\nTotal: 120.00');
  const [submitting, setSubmitting] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [files, setFiles] = useState<FileRec[]>([]);
  const [localFiles, setLocalFiles] = useState<File[]>([]);
  const [url, setUrl] = useState('');

  async function submitText() {
    if (!id) return;
    setSubmitting(true);
    try {
      const res = await fetch(`http://localhost:3001/projects/${id}/files`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, mime: 'text/plain', text }) });
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
      const res = await fetch(`http://localhost:3001/projects/${id}/files`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ files: filesPayload }) });
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
      const res = await fetch(`http://localhost:3001/projects/${id}/files`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
      const data = await res.json();
      setJobId(data?.job_id || null);
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    let t: any;
    async function poll() {
      if (!jobId) return;
      const r = await fetch(`http://localhost:3001/jobs/${jobId}`);
      const d = await r.json();
      if (d.status === 'done' || d.status === 'failed') {
        setJobId(null);
        refreshFiles();
      } else {
        t = setTimeout(poll, 750);
      }
    }
    poll();
    return () => { if (t) clearTimeout(t); };
  }, [jobId]);

  async function refreshFiles() {
    if (!id) return;
    const res = await fetch(`http://localhost:3001/projects/${id}/files`);
    const data = await res.json();
    setFiles(data || []);
  }

  useEffect(() => { refreshFiles(); }, [id]);

  return (
    <div style={{ padding: 20 }}>
      <h1>Ingest Files</h1>
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <h3>Paste Text</h3>
          <div>
            <label>Filename:&nbsp;</label>
            <input value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div style={{ marginTop: 8 }}>
            <label>Text content:</label>
            <textarea value={text} onChange={e => setText(e.target.value)} rows={10} style={{ width: '100%' }} />
          </div>
          <button onClick={submitText} disabled={submitting || !id}>{submitting ? 'Uploading...' : 'Upload Text'}</button>
        </div>
        <div style={{ flex: 1 }}>
          <h3>Upload Files</h3>
          <input type="file" multiple onChange={e => setLocalFiles(Array.from(e.target.files || []))} />
          <div style={{ marginTop: 8 }}>
            <button onClick={submitFiles} disabled={submitting || !id || localFiles.length === 0}>{submitting ? 'Uploading...' : `Upload ${localFiles.length || ''} File(s)`}</button>
          </div>
          <div style={{ marginTop: 16 }}>
            <h4>Fetch URL</h4>
            <input placeholder="https://example.com/page" value={url} onChange={e => setUrl(e.target.value)} style={{ width: '100%' }} />
            <div style={{ marginTop: 8 }}>
              <button onClick={submitUrl} disabled={submitting || !id || !url.trim()}>{submitting ? 'Fetching...' : 'Ingest URL'}</button>
            </div>
          </div>
          {jobId && <div style={{ marginTop: 8 }}>Job: {jobId} (processing)</div>}
        </div>
        <div style={{ flex: 1 }}>
          <h3>Files</h3>
          <table cellPadding={6} style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th>Name</th><th>Status</th><th>Pages</th><th>Actions</th></tr></thead>
            <tbody>
              {files.map(f => (
                <tr key={f.id}>
                  <td>{f.name}</td>
                  <td>{f.status}</td>
                  <td>{f.pages}</td>
                  <td>
                    <a href={`/projects/${id}/results/${f.id}`}>View Results</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
