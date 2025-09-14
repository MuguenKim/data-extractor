import express from "express";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = Number(process.env.WORKER_HTTP_PORT ?? 3002);

app.get("/health", (_req: any, res: any) => res.json({ ok: true, worker: true }));

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Worker stub listening on :${PORT}`);
});
