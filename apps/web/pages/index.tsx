import Link from "next/link";
import Layout from "../components/Layout";

export default function Home() {
  return (
    <Layout>
      <section className="hero">
        <h1 className="hero-title">Turn messy documents into clean, validated JSON</h1>
        <p className="hero-sub">Projects for your files, schema-controlled extraction with Groq/Ollama, and inline validation — all in a crisp, fast UI.</p>
        <div className="hero-cta">
          <Link className="btn btn-primary" href="/projects">Get Started</Link>
          <a className="btn btn-secondary" href="/projects">Create Project</a>
          <a className="btn btn-ghost" href="/workflows">Browse Workflows</a>
        </div>
      </section>

      <div style={{ height: 16 }} />

      <section className="feature-grid">
        <div className="feature">
          <div className="icon">📄</div>
          <h4>Ingest anything</h4>
          <p>PDF, images, HTML, DOCX, CSV — normalized text + spans per page.</p>
        </div>
        <div className="feature">
          <div className="icon">🧩</div>
          <h4>Schema-driven</h4>
          <p>Select or infer formats, edit JSON, and validate with rules.</p>
        </div>
        <div className="feature">
          <div className="icon">⚡</div>
          <h4>LLM + Baseline</h4>
          <p>Regex heuristics or LangExtract via Groq/Ollama — your choice.</p>
        </div>
      </section>

      <div style={{ height: 16 }} />

      <section>
        <div className="section-title">How it works</div>
        <div className="stepper">
          <div className="stepper-line" />
          <div className="step-card">
            <div className="step-head">
              <div className="dot">1</div>
              <h3 className="step-title">Create Project</h3>
            </div>
            <div className="step-desc">Group related documents and keep runs, schemas, and results in one place.</div>
            <div className="step-cta">
              <Link className="btn btn-secondary" href="/projects">New Project</Link>
            </div>
            <div className="snippet">POST /projects → {`{ id }`}</div>
          </div>

          <div className="step-card">
            <div className="step-head">
              <div className="dot">2</div>
              <h3 className="step-title">Ingest Data</h3>
            </div>
            <div className="step-desc">Upload files, paste text, or fetch a URL. We normalize text and save spans per page.</div>
            <div className="step-cta">
              <Link className="btn btn-secondary" href="/projects">Go to Ingest</Link>
            </div>
            <div className="snippet">POST /projects/:id/files → creates Ingest Job</div>
          </div>

          <div className="step-card">
            <div className="step-head">
              <div className="dot">3</div>
              <h3 className="step-title">Choose or Infer Format</h3>
            </div>
            <div className="step-desc">Select a known schema (e.g., invoice.v1) or infer and edit a draft in the JSON editor. Set as Active Format.</div>
            <div className="step-cta">
              <Link className="btn btn-secondary" href="/projects">Open Format</Link>
            </div>
            <div className="snippet">POST /projects/:id/schemas | POST /projects/:id/infer_schema | PATCH /projects/:id/format</div>
          </div>

          <div className="step-card">
            <div className="step-head">
              <div className="dot">4</div>
              <h3 className="step-title">Extract & Validate</h3>
            </div>
            <div className="step-desc">Run extraction over all files with your Active Format. Review fields, spans, and rules in the inline viewer.</div>
            <div className="step-cta">
              <Link className="btn btn-primary" href="/projects">Run Extraction</Link>
            </div>
            <div className="snippet">POST /projects/:id/extract → GET /projects/:id/results</div>
          </div>
        </div>
      </section>

      <div className="footer">No dark UI. Clean, fast, and precise.</div>
    </Layout>
  );
}

