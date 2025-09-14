import { useEffect, useState } from "react";
import { useRouter } from "next/router";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export default function JobPage() {
  const router = useRouter();
  const { id } = router.query as { id?: string };
  const [job, setJob] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let active = true;
    async function poll() {
      try {
        const res = await fetch(`${API}/jobs/${id}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed');
        if (!active) return;
        setJob(data);
        if (data.status === 'processing' || data.status === 'queued') {
          setTimeout(poll, 1000);
        }
      } catch (e: any) {
        if (!active) return;
        setErr(String(e));
      }
    }
    poll();
    return () => { active = false; };
  }, [id]);

  function downloadJSON() {
    if (!job?.result) return;
    const blob = new Blob([JSON.stringify(job.result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `job-${job.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h1>Job {id}</h1>
      {err && <p style={{ color: 'red' }}>{err}</p>}
      {!job && <p>Loading…</p>}
      {job && (
        <div>
          <p>Status: <b>{job.status}</b></p>
          {job.result && (
            <div style={{ display: 'flex', gap: 24 }}>
              <div style={{ flex: 1 }}>
                <h2>Fields</h2>
                <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                  <thead>
                    <tr><th align="left">Field</th><th align="left">Value</th><th align="left">Confidence</th></tr>
                  </thead>
                  <tbody>
                    {Object.entries(job.result.fields).map(([k, v]: any) => (
                      <tr key={k}>
                        <td style={{ borderBottom: '1px solid #eee', padding: '6px 4px' }}><code>{k}</code></td>
                        <td style={{ borderBottom: '1px solid #eee', padding: '6px 4px' }}>{String(v.value)}</td>
                        <td style={{ borderBottom: '1px solid #eee', padding: '6px 4px' }}>{(v.confidence*100).toFixed(0)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button style={{ marginTop: 12 }} onClick={downloadJSON}>Download JSON</button>
              </div>
              <div style={{ flex: 1 }}>
                <h2>Document Viewer</h2>
                <p>Not implemented yet. Spans available for highlight.</p>
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}

