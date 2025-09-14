import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

interface FileSummary { file_id: string; status: string }

export default function ExtractPage() {
  const router = useRouter();
  const { id } = router.query as { id?: string };
  const [summaries, setSummaries] = useState<FileSummary[]>([]);
  const [running, setRunning] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refreshResults() {
    if (!id) return;
    const res = await fetch(`http://localhost:3001/projects/${id}/results`);
    const data = await res.json();
    setSummaries(data || []);
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
          // No Active Workflow: direct the user to the Format page
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

  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    let t: any;
    async function poll() {
      const r = await fetch(`http://localhost:3001/jobs/${jobId}`);
      const d = await r.json();
      if (cancelled) return;
      if (d.status === 'done') {
        setRunning(false);
        setJobId(null);
        refreshResults();
      } else if (d.status === 'failed') {
        setRunning(false);
        setJobId(null);
        setError(d.error || 'unknown error');
      } else {
        t = setTimeout(poll, 800);
      }
    }
    poll();
    return () => { cancelled = true; if (t) clearTimeout(t); };
  }, [jobId]);

  return (
    <div style={{ padding: 20 }}>
      <h1>Structured Extraction</h1>
      <p>Runs schema-controlled extraction across all processed files for this project.</p>
      <div style={{ marginTop: 8 }}>
        <button onClick={startExtraction} disabled={running}>{running ? 'Running…' : 'Run Extraction'}</button>
        {error && <span style={{ color: 'red', marginLeft: 12 }}>{error}</span>}
      </div>
      <div style={{ marginTop: 16 }}>
        <h3>Results</h3>
        <ul>
          {summaries.map((s) => (
            <li key={s.file_id}>
              File {s.file_id}: {s.status} — <a href={`/projects/${id}/results/${s.file_id}`}>Open</a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
