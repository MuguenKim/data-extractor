import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

export default function ProjectOverview() {
  const router = useRouter();
  const { id } = router.query as { id?: string };
  const [data, setData] = useState<any | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    fetch(`http://localhost:3001/projects/${id}`).then(r => r.json()).then(d => { if (!cancelled) setData(d); });
    return () => { cancelled = true; };
  }, [id]);

  return (
    <div style={{ padding: 20 }}>
      <h1>Project Overview</h1>
      {data ? (
        <div>
          <div>ID: {data.id}</div>
          <div>Name: {data.name}</div>
          <div>Files: {data.files_count} (processed {data.processed})</div>
          <div style={{ marginTop: 12 }}>
            <a href={`/projects/${data.id}/ingest`}>Go to Ingest</a> |{' '}
            <a href={`/projects/${data.id}/extract`}>Extract</a>
          </div>
        </div>
      ) : (
        <div>Loading...</div>
      )}
    </div>
  );
}
