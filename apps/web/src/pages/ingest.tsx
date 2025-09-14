import { useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3001';

type Job = { id: string; status: string; result?: any };

export default function IngestPage() {
  const [mode, setMode] = useState<'text' | 'file' | 'url'>('text');
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [language, setLanguage] = useState('');
  const [piiMask, setPiiMask] = useState(true);
  const [loading, setLoading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function fileToBase64(f: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve((r.result as string).split(',')[1] || '');
      r.onerror = () => reject(r.error);
      r.readAsDataURL(f);
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setJob(null);
    setJobId(null);
    try {
      let body: any = { input: {}, options: { language: language || undefined, pii_mask: piiMask } };
      if (mode === 'text') {
        if (!text.trim()) throw new Error('Enter text');
        body.input.text = text;
      } else if (mode === 'url') {
        if (!url.trim()) throw new Error('Enter URL');
        body.input.url = url.trim();
      } else if (mode === 'file') {
        if (!file) throw new Error('Choose a file');
        const base64 = await fileToBase64(file);
        body.input.file = { name: file.name, mime: file.type || undefined, base64 };
      }
      const r = await fetch(`${API_BASE}/extract`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || 'extract_failed');
      setJobId(j.job_id);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  async function refreshJob() {
    if (!jobId) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${API_BASE}/jobs/${jobId}`);
      const j = await r.json();
      setJob(j);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 900 }}>
      <h1>Ingest Document</h1>
      <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
        <div>
          <label>
            <input type="radio" checked={mode === 'text'} onChange={() => setMode('text')} /> Text
          </label>
          {'  '}
          <label>
            <input type="radio" checked={mode === 'file'} onChange={() => setMode('file')} /> File
          </label>
          {'  '}
          <label>
            <input type="radio" checked={mode === 'url'} onChange={() => setMode('url')} /> URL
          </label>
        </div>

        {mode === 'text' && (
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} style={{ width: '100%' }} placeholder="Paste text here" />
        )}
        {mode === 'url' && (
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" style={{ width: '100%', padding: 8 }} />
        )}
        {mode === 'file' && (
          <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        )}

        <div style={{ display: 'flex', gap: 12 }}>
          <input value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="language hint (optional)" />
          <label title="Mask PII at storage boundary">
            <input type="checkbox" checked={piiMask} onChange={(e) => setPiiMask(e.target.checked)} /> PII mask
          </label>
        </div>

        <div>
          <button type="submit" disabled={loading}>{loading ? 'Submitting…' : 'Submit'}</button>
        </div>
      </form>

      {jobId && (
        <section style={{ marginTop: 24 }}>
          <h3>Job</h3>
          <div>job_id: <code>{jobId}</code></div>
          <div>View: <a href={`/jobs/${jobId}`}>open job viewer</a></div>
          <button onClick={refreshJob} disabled={loading} style={{ marginTop: 8 }}>Refresh job</button>
        </section>
      )}

      {error && (
        <div style={{ color: 'crimson', marginTop: 16 }}>Error: {error}</div>
      )}

      {job && (
        <section style={{ marginTop: 24 }}>
          <h3>Job Status</h3>
          <div>Status: <strong>{job.status}</strong></div>
          <pre style={{ background: '#111', color: '#0f0', padding: 12, overflowX: 'auto' }}>{JSON.stringify(job.result, null, 2)}</pre>
        </section>
      )}
    </main>
  );
}
