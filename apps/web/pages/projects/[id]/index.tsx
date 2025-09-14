import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

export default function ProjectOverview() {
  const router = useRouter();
  const { id } = router.query as { id?: string };
  const [data, setData] = useState<any | null>(null);
  const [wfSummary, setWfSummary] = useState<{ id: string; backend: string; schema_id: string } | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    async function load() {
      const d = await fetch(`http://localhost:3001/projects/${id}`).then(r => r.json());
      if (cancelled) return;
      setData(d);
      if (d.active_workflow_id) {
        const wfr = await fetch(`http://localhost:3001/projects/${id}/workflows`).then(r => r.json());
        if (cancelled) return;
        const found = (wfr.workflows || []).find((w: any) => w.id === d.active_workflow_id);
        if (found) setWfSummary({ id: found.id, backend: found.backend, schema_id: found.schema?.id });
      } else {
        setWfSummary(null);
      }
    }
    load();
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
          <div style={{ marginTop: 8 }}>
            {wfSummary ? (
              <div>
                Selected Format/Workflow: <code>{wfSummary.id}</code> — backend: {wfSummary.backend}, schema: {wfSummary.schema_id} {' '}
                <a href={`/projects/${data.id}/format`}>(change)</a>
              </div>
            ) : (
              <div>
                No Active Workflow. <a href={`/projects/${data.id}/format`}>Select or create one</a>.
              </div>
            )}
          </div>
          <div style={{ marginTop: 12 }}>
            <a href={`/projects/${data.id}/ingest`}>Go to Ingest</a> |{' '}
            <a href={`/projects/${data.id}/format`}>Choose Format</a> |{' '}
            <a href={`/projects/${data.id}/extract`}>Extract</a>
          </div>
        </div>
      ) : (
        <div>Loading...</div>
      )}
    </div>
  );
}
