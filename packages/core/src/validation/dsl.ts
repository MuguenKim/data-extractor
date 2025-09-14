import { ResultEnvelope } from "../types";

// Very small DSL evaluator for a handful of functions.
// Supports: equals(a,b,tol?), add(a,b), sum(arrayField), in_set(x,[...]), match(x,regex), date_le(a,b)

export interface DSLResult {
  passed: string[];
  failed: string[];
}

export function evaluateRules(result: ResultEnvelope, rules: string[]): DSLResult {
  const passed: string[] = [];
  const failed: string[] = [];
  for (const expr of rules) {
    try {
      const ok = evalExpr(expr, result);
      if (ok) passed.push(expr); else failed.push(expr);
    } catch {
      failed.push(expr);
    }
  }
  return { passed, failed };
}

function evalExpr(expr: string, result: ResultEnvelope): boolean {
  const trimmed = expr.trim();
  if (trimmed.startsWith("equals(")) return evalEquals(args(trimmed), result);
  if (trimmed.startsWith("in_set(")) return evalInSet(args(trimmed), result);
  if (trimmed.startsWith("match(")) return evalMatch(args(trimmed), result);
  if (trimmed.startsWith("date_le(")) return evalDateLe(args(trimmed), result);
  throw new Error("unsupported expr");
}

function args(call: string): string[] {
  const inside = call.slice(call.indexOf("(") + 1, call.lastIndexOf(")"));
  // split by commas not in brackets
  const parts: string[] = [];
  let depth = 0, cur = "";
  for (const ch of inside) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(cur.trim());
      cur = "";
    } else {
      if (ch !== ',' || depth > 0) cur += ch;
    }
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

function resolveValue(token: string, result: ResultEnvelope): any {
  token = token.trim();
  if (token.startsWith("sum(")) {
    const field = token.slice(4, -1).trim();
    const fr = result.fields[field];
    if (!fr || !Array.isArray(fr.value)) return null;
    return fr.value.reduce((a: number, b: any) => a + (Number(b) || 0), 0);
  }
  if (token.startsWith("add(")) {
    const [a, b] = args(token);
    return (Number(resolveValue(a, result)) || 0) + (Number(resolveValue(b, result)) || 0);
  }
  if (/^\d+(\.\d+)?$/.test(token)) return Number(token);
  if (token.startsWith('"') && token.endsWith('"')) return token.slice(1, -1);
  // treat as field name
  const fr = result.fields[token];
  return fr?.value ?? null;
}

function evalEquals(argv: string[], result: ResultEnvelope): boolean {
  const [a, b, tolArg] = argv;
  const va = Number(resolveValue(a, result));
  const vb = Number(resolveValue(b, result));
  const tol = tolArg ? Number(tolArg.split('=')[1]) : 0;
  if (!Number.isFinite(va) || !Number.isFinite(vb)) return false;
  return Math.abs(va - vb) <= tol;
}

function evalInSet(argv: string[], result: ResultEnvelope): boolean {
  const [x, list] = argv;
  const vx = String(resolveValue(x, result) ?? "");
  const set = JSON.parse(list.replace(/'/g, '"')) as string[];
  return set.includes(vx);
}

function evalMatch(argv: string[], result: ResultEnvelope): boolean {
  const [x, rxStr] = argv;
  const vx = String(resolveValue(x, result) ?? "");
  const pat = rxStr.trim().replace(/^"|"$/g, "");
  const rx = new RegExp(pat);
  return rx.test(vx);
}

function evalDateLe(argv: string[], result: ResultEnvelope): boolean {
  const [a, b] = argv;
  const va = new Date(String(resolveValue(a, result))); 
  const vb = new Date(String(resolveValue(b, result)));
  return va.getTime() <= vb.getTime();
}

