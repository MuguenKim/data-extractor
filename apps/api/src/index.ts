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
type JobRecord = { id: string; status: "queued" | "processing" | "done" | "failed"; result?: ResultEnvelope; error?: string };
const jobs = new Map<string, JobRecord>();

function loadSchemaById(id: string): WorkflowSchema | null {
  if (id === "invoice.v1") return (invoiceSchemaV1 as any) as WorkflowSchema;
  return null;
}

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
