import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";
import {
  extract_with_langextract,
  invoiceSchemaV1,
  WorkflowConfig,
  WorkflowSchema,
  ResultEnvelope,
  ingestBufferAsync,
  ingestFromText,
  ingestHTMLString,
} from "@core";

dotenv.config();

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(cors());
app.use(helmet());
app.use(morgan("dev"));

const API_PORT = Number(process.env.API_PORT ?? 3001);

// In-memory stores for dev (no Redis/DB)
const workflows = new Map<string, WorkflowConfig>();
type JobRecord = { id: string; status: "queued" | "processing" | "done" | "failed"; result?: any; error?: string };
const jobs = new Map<string, JobRecord>();

// M1 in-memory dev stores (project/file/artifacts/results)
interface ProjectRec { id: string; name: string; created_by?: string; created_at: string }
interface FileRec {
  id: string;
  project_id: string;
  name: string;
  mime: string;
  pages: number;
  storage_uri?: string;
  status: "uploaded" | "processed" | "failed";
}
interface TextArtifactRec { file_id: string; page_no: number; text: string; char_offsets?: number[]; bbox_map?: any }

const projects = new Map<string, ProjectRec>();
const files = new Map<string, FileRec>();
const projectFiles = new Map<string, Set<string>>();
const textArtifacts = new Map<string, TextArtifactRec[]>();
const extractionResults = new Map<string, any /* ExtractionResult DTO */>();

function loadSchemaById(id: string): WorkflowSchema | null {
  if (id === "invoice.v1") return (invoiceSchemaV1 as any) as WorkflowSchema;
  return null;
}

// --- M1: Projects & Files ---

// POST /projects -> {id}
app.post("/projects", (req: any, res: any) => {
  const id = uuidv4();
  const name = (req.body?.name as string) || `Project ${id.slice(0, 8)}`;
  const rec: ProjectRec = { id, name, created_at: new Date().toISOString() };
  projects.set(id, rec);
  projectFiles.set(id, new Set());
  res.json({ id });
});

// GET /projects/:id -> summary
app.get("/projects/:id", (req: any, res: any) => {
  const p = projects.get(req.params.id);
  if (!p) return res.status(404).json({ error: "not_found" });
  const fileIds = Array.from(projectFiles.get(p.id) ?? []);
  const fileRecs = fileIds.map((fid) => files.get(fid)!).filter(Boolean);
  const processed = fileRecs.filter((f) => f.status === "processed").length;
  res.json({ id: p.id, name: p.name, files_count: fileRecs.length, processed, created_at: p.created_at });
});

// POST /projects/:id/files (dev-min JSON upload)
// Accepts { name, mime, text } or { name, mime, pages: [{page_no,text},...] }
app.post("/projects/:id/files", async (req: any, res: any) => {
  const p = projects.get(req.params.id);
  if (!p) return res.status(404).json({ error: "project_not_found" });

  const jobId = uuidv4();
  const job: JobRecord = { id: jobId, status: "processing" };
  jobs.set(jobId, job);
  res.json({ job_id: jobId });

  // Process synchronously for dev
  try {
    const body = req.body || {};

    const processedFileIds: string[] = [];

    // 1) URL ingestion: { url }
    if (typeof body.url === "string" && body.url.trim()) {
      const url = String(body.url).trim();
      const resp = await fetch(url);
      const html = await resp.text();
      const doc = ingestHTMLString(html, { filename: url, mime: resp.headers.get('content-type') || 'text/html' });

      const fileId = uuidv4();
      const name = url.split('/').pop() || `url-${Date.now()}.html`;
      const fileRec: FileRec = { id: fileId, project_id: p.id, name, mime: 'text/html', pages: 0, status: "uploaded" };
      files.set(fileId, fileRec);
      (projectFiles.get(p.id) as Set<string>).add(fileId);

      const ta = sliceArtifactsFromDocument(doc, fileId);
      textArtifacts.set(fileId, ta);
      fileRec.pages = ta.length;
      fileRec.status = ta.length > 0 ? "processed" : "failed";
      files.set(fileId, fileRec);
      processedFileIds.push(fileId);
    }

    // 2) Multi-file base64 ingestion: { files: [{ name, mime, data_base64 }] }
    if (Array.isArray(body.files) && body.files.length > 0) {
      for (const f of body.files) {
        const name: string = f.name || `upload-${Date.now()}.bin`;
        const mime: string = f.mime || "application/octet-stream";
        const b64: string = String(f.data_base64 || "");
        if (!b64) continue;
        const buf = Buffer.from(b64, 'base64');
        const doc = await ingestBufferAsync(buf, { filename: name, mime });

        const fileId = uuidv4();
        const fileRec: FileRec = { id: fileId, project_id: p.id, name, mime, pages: 0, status: "uploaded" };
        files.set(fileId, fileRec);
        (projectFiles.get(p.id) as Set<string>).add(fileId);

        const ta = sliceArtifactsFromDocument(doc, fileId);
        textArtifacts.set(fileId, ta);
        fileRec.pages = ta.length;
        fileRec.status = ta.length > 0 ? "processed" : "failed";
        files.set(fileId, fileRec);
        processedFileIds.push(fileId);
      }
    }

    // 3) Existing JSON modes: { text } or { pages: [{page_no,text}] }
    if (!processedFileIds.length) {
      const name: string = body.name || `file-${Date.now()}.txt`;
      const mime: string = body.mime || "text/plain";
      const fileId = uuidv4();
      const fileRec: FileRec = { id: fileId, project_id: p.id, name, mime, pages: 0, status: "uploaded" };
      files.set(fileId, fileRec);
      (projectFiles.get(p.id) as Set<string>).add(fileId);

      const ta: TextArtifactRec[] = [];
      if (Array.isArray(body.pages)) {
        for (const pg of body.pages) {
          ta.push({ file_id: fileId, page_no: Number(pg.page_no) || (ta.length + 1), text: String(pg.text || "") });
        }
      } else if (typeof body.text === "string") {
        // Run through simple text ingest to normalize page map
        const doc = ingestFromText(body.text, { filename: name, mime });
        const sliced = sliceArtifactsFromDocument(doc, fileId);
        ta.push(...sliced);
      }
      textArtifacts.set(fileId, ta);
      fileRec.pages = ta.length;
      fileRec.status = ta.length > 0 ? "processed" : "failed";
      files.set(fileId, fileRec);
      processedFileIds.push(fileId);
    }

    job.status = "done";
    job.result = { file_ids: processedFileIds, count: processedFileIds.length };
    jobs.set(jobId, job);
  } catch (e: any) {
    job.status = "failed";
    job.error = e?.message ?? String(e);
    jobs.set(jobId, job);
  }
});

// GET /projects/:id/files -> list with statuses
app.get("/projects/:id/files", (req: any, res: any) => {
  const p = projects.get(req.params.id);
  if (!p) return res.status(404).json({ error: "project_not_found" });
  const ids = Array.from(projectFiles.get(p.id) ?? []);
  res.json(ids.map((fid) => files.get(fid)));
});

function sliceArtifactsFromDocument(doc: { text: string; pageMap: Array<{ page: number; start: number; end: number }> }, fileId: string): TextArtifactRec[] {
  const out: TextArtifactRec[] = [];
  const full = doc.text || "";
  for (const span of doc.pageMap || []) {
    const text = full.slice(span.start, span.end);
    out.push({ file_id: fileId, page_no: Number(span.page) || (out.length + 1), text });
  }
  if (out.length === 0) out.push({ file_id: fileId, page_no: 1, text: full });
  return out;
}

// GET raw text for a file (concat pages)
app.get("/projects/:id/files/:fileId/text", (req: any, res: any) => {
  const p = projects.get(req.params.id);
  if (!p) return res.status(404).json({ error: "project_not_found" });
  const f = files.get(req.params.fileId);
  if (!f || f.project_id !== p.id) return res.status(404).json({ error: "file_not_found" });
  const pages = textArtifacts.get(f.id) ?? [];
  res.type("text/plain").send(pages.map((pg) => pg.text).join("\n\n"));
});

// --- M1: Baseline Extract over all project files ---
// POST /projects/:id/extract (baseline)
app.post("/projects/:id/extract", async (req: any, res: any) => {
  const p = projects.get(req.params.id);
  if (!p) return res.status(404).json({ error: "project_not_found" });
  const ids = Array.from(projectFiles.get(p.id) ?? []);
  const ready = ids.map((fid) => files.get(fid)!).filter((f) => f && f.status === "processed");

  const jobId = uuidv4();
  const job: JobRecord = { id: jobId, status: "processing" };
  jobs.set(jobId, job);
  res.json({ job_id: jobId, total: ready.length });

  try {
    const schema = (invoiceSchemaV1 as any) as WorkflowSchema;
    for (const f of ready) {
      const pages = textArtifacts.get(f.id) ?? [];
      const fullText = pages.map((pg) => pg.text).join("\n\n");
      const result = await extract_with_langextract({ schema, text: fullText, backend: "mock" });
      const envelope: any = {
        schema_id: schema.id || "invoice.v1",
        file_id: f.id,
        ...result,
      };
      extractionResults.set(f.id, envelope);
    }
    job.status = "done";
    jobs.set(jobId, job);
  } catch (e: any) {
    job.status = "failed";
    job.error = e?.message ?? String(e);
    jobs.set(jobId, job);
  }
});

// GET /projects/:id/results -> summaries (raw text availability)
app.get("/projects/:id/results", (req: any, res: any) => {
  const p = projects.get(req.params.id);
  if (!p) return res.status(404).json({ error: "project_not_found" });
  const ids = Array.from(projectFiles.get(p.id) ?? []);
  const out = ids.map((fid) => {
    const arts = textArtifacts.get(fid) ?? [];
    const has = arts.length > 0;
    return { file_id: fid, status: has ? "ok" : (files.get(fid)?.status ?? "uploaded") };
  });
  res.json(out);
});

// GET /projects/:id/results/:fileId -> raw text summary
app.get("/projects/:id/results/:fileId", (req: any, res: any) => {
  const p = projects.get(req.params.id);
  if (!p) return res.status(404).json({ error: "project_not_found" });
  const f = files.get(req.params.fileId);
  if (!f || f.project_id !== p.id) return res.status(404).json({ error: "file_not_found" });
  const arts = textArtifacts.get(f.id) ?? [];
  if (arts.length === 0) return res.status(404).json({ error: "no_text" });
  const totalChars = arts.reduce((a, b) => a + (b.text?.length || 0), 0);
  res.json({ file_id: f.id, pages: arts.length, total_chars: totalChars, status: "ok" });
});

// GET /projects/:id/files/:fileId (metadata)
app.get("/projects/:id/files/:fileId", (req: any, res: any) => {
  const p = projects.get(req.params.id);
  if (!p) return res.status(404).json({ error: "project_not_found" });
  const f = files.get(req.params.fileId);
  if (!f || f.project_id !== p.id) return res.status(404).json({ error: "file_not_found" });
  res.json(f);
});

// POST /workflows {schema_id|schema_json, backend, ocr_policy, lang_hint}
app.post("/workflows", (req: any, res: any) => {
  try {
    const { schema_id, schema_json, backend, ocr_policy, lang_hint, id } = req.body || {};
    let schema: WorkflowSchema | null = null;
    if (schema_id) schema = loadSchemaById(schema_id);
    if (!schema && schema_json) schema = schema_json as WorkflowSchema;
    if (!schema) return res.status(400).json({ error: "schema_id or schema_json required" });

    const wfId: string = id ?? uuidv4();
    const wf: WorkflowConfig = {
      id: wfId,
      schema,
      backend: (backend ?? (process.env.DEFAULT_BACKEND as any) ?? "groq"),
      ocr_policy: ocr_policy ?? "none",
      lang_hint,
    };
    workflows.set(wfId, wf);
    return res.json(wf);
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// POST /extract?workflow_id=... { text }
app.post("/extract", async (req: any, res: any) => {
  const workflow_id = String(req.query.workflow_id || "");
  if (!workflow_id) return res.status(400).json({ error: "workflow_id required" });
  const wf = workflows.get(workflow_id);
  if (!wf) return res.status(404).json({ error: "workflow not found" });

  const { text } = req.body || {};
  if (!text || typeof text !== "string") return res.status(400).json({ error: "text required" });

  const jobId = uuidv4();
  const job: JobRecord = { id: jobId, status: "processing" };
  jobs.set(jobId, job);
  res.json({ job_id: jobId });

  try {
    const result = await extract_with_langextract({
      schema: wf.schema,
      text,
      backend: wf.backend ?? "auto",
    });
    job.status = "done";
    job.result = result;
    jobs.set(jobId, job);
  } catch (e: any) {
    job.status = "failed";
    job.error = e?.message ?? String(e);
    jobs.set(jobId, job);
  }
});

// GET /jobs/:id
app.get("/jobs/:id", (req: any, res: any) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: "not found" });
  res.json(job);
});

// POST /validate { data, rules }
app.post("/validate", async (req: any, res: any) => {
  try {
    const { evaluateRules } = await import("@core");
    const { data, rules } = req.body || {};
    if (!data || !Array.isArray(rules)) return res.status(400).json({ error: "data and rules[] required" });
    const out = evaluateRules(data, rules);
    res.json(out);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/health", (_req: any, res: any) => res.json({ ok: true }));

app.listen(API_PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`API listening on :${API_PORT}`);
});
