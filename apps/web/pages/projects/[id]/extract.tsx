import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

interface FileSummary { file_id: string; status: string }

export default function ExtractPage() {
  const router = useRouter();
  const { id } = router.query as { id?: string };
  const [summaries, setSummaries] = useState<FileSummary[]>([]);

  async function refreshResults() {
    if (!id) return;
    const res = await fetch(`http://localhost:3001/projects/${id}/results`);
    const data = await res.json();
    setSummaries(data || []);
  }

  useEffect(() => { refreshResults(); }, [id]);

  return (
    <div style={{ padding: 20 }}>
      <h1>Automatic Processing</h1>
      <p>Files are processed immediately after upload. View results below or open a file.</p>
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
