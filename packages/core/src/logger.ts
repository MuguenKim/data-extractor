type Level = "trace" | "debug" | "info" | "warn" | "error";

interface BaseCtx {
  service?: string;
  project_id?: string;
  file_id?: string;
  job_id?: string;
  workflow_id?: string;
}

interface LogOptions {
  level?: Level;
  format?: "json" | "pretty";
}

export interface Logger {
  child(ctx: BaseCtx): Logger;
  trace(msg: string, ctx?: Record<string, any>): void;
  debug(msg: string, ctx?: Record<string, any>): void;
  info(msg: string, ctx?: Record<string, any>): void;
  warn(msg: string, ctx?: Record<string, any>): void;
  error(msg: string, ctx?: Record<string, any>): void;
}

const LEVELS: Level[] = ["trace", "debug", "info", "warn", "error"];

function levelIndex(l: Level): number { return LEVELS.indexOf(l); }

function nowISO() { return new Date().toISOString(); }

export function getLogger(service?: string, opts: LogOptions = {}): Logger {
  const env = (typeof process !== "undefined" ? process.env : {}) as any;
  const lvl = (opts.level || (env.LOG_LEVEL as Level) || "info") as Level;
  const fmt = (opts.format || (env.LOG_FORMAT as any) || "pretty") as "json" | "pretty";
  const base: BaseCtx = { service };

  function emit(level: Level, msg: string, extra?: Record<string, any>) {
    if (levelIndex(level) < levelIndex(lvl)) return;
    const entry = { ts: nowISO(), level, msg, ...base, ...(extra || {}) } as any;
    if (fmt === "json") {
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(entry));
    } else {
      const ctx = { ...entry };
      const head = `[${ctx.ts}] ${ctx.level.toUpperCase()}${ctx.service ? ` ${ctx.service}` : ""}`;
      delete ctx.ts; delete ctx.level; delete ctx.msg; delete ctx.service;
      const ctxStr = Object.keys(ctx).length ? ` ${JSON.stringify(ctx)}` : "";
      // eslint-disable-next-line no-console
      console.log(`${head} - ${msg}${ctxStr}`);
    }
  }

  function withBase(newBase: BaseCtx): Logger {
    const merged = { ...base, ...newBase };
    return create(merged);
  }

  function create(current: BaseCtx): Logger {
    Object.assign(base, current);
    return {
      child(ctx: BaseCtx) { return withBase(ctx); },
      trace(msg, ctx) { emit("trace", msg, ctx); },
      debug(msg, ctx) { emit("debug", msg, ctx); },
      info(msg, ctx) { emit("info", msg, ctx); },
      warn(msg, ctx) { emit("warn", msg, ctx); },
      error(msg, ctx) { emit("error", msg, ctx); },
    };
  }

  return create(base);
}

