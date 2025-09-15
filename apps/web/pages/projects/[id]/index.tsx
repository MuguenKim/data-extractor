import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Layout from '../../../components/Layout';

export default function ProjectOverview() {
  const router = useRouter();
  const { id } = router.query as { id?: string };
  const [data, setData] = useState<any | null>(null);
  const [formatSummary, setFormatSummary] = useState<{ schema_id: string | null; backend?: string } | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    async function load() {
      const d = await fetch(`http://localhost:3001/projects/${id}`).then(r => r.json());
      if (cancelled) return;
      setData(d);
      // Prefer AGENTS.md contract: active_schema_id
      if (d.active_schema_id) {
        setFormatSummary({ schema_id: d.active_schema_id });
        return;
      }
      // Fallback to workflow-based project summary
      if (d.active_workflow_id) {
        const wfr = await fetch(`http://localhost:3001/projects/${id}/workflows`).then(r => r.json());
        if (cancelled) return;
        const found = (wfr.workflows || []).find((w: any) => w.id === d.active_workflow_id);
        if (found) setFormatSummary({ schema_id: found?.schema?.id || null, backend: found?.backend });
        else setFormatSummary(null);
      } else {
        setFormatSummary(null);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [id]);

  return (
    <Layout>
      <h1 className="page-title">Project Overview</h1>
      {!data ? (
        <div className="badge">Loading…</div>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div className="card card-pad">
            <div className="section-title">Details</div>
            <div><strong>Name:</strong> {data.name}</div>
            <div><strong>ID:</strong> <code>{data.id}</code></div>
            <div><strong>Files:</strong> {data.files_count} <span className="muted">(processed {data.processed})</span></div>
          </div>
          <div className="card card-pad">
            <div className="section-title">Selected Format</div>
            {formatSummary?.schema_id ? (
              <div>
                <span>Active:</span> <code>{formatSummary.schema_id}</code>{formatSummary.backend ? <> — backend: <span className="badge">{formatSummary.backend}</span></> : null}
                <div style={{ marginTop: 8 }}>
                  <a className="btn btn-secondary" href={`/projects/${data.id}/format`}>Change</a>
                </div>
              </div>
            ) : (
              <div>
                <div className="page-sub">No format selected.</div>
                <a className="btn btn-primary" href={`/projects/${data.id}/format`}>Choose a format</a>
              </div>
            )}
          </div>
          <div className="card card-pad" style={{ gridColumn: '1 / span 2' }}>
            <div className="section-title">Quick Links</div>
            <div className="row">
              <a className="btn btn-secondary" href={`/projects/${data.id}/ingest`}>Ingest</a>
              <a className="btn btn-secondary" href={`/projects/${data.id}/format`}>Format</a>
              <a className="btn btn-primary" href={`/projects/${data.id}/extract`}>Extract</a>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
