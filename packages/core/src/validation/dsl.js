"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateRules = evaluateRules;
function evaluateRules(result, rules) {
    const passed = [];
    const failed = [];
    for (const expr of rules) {
        try {
            const ok = evalExpr(expr, result);
            if (ok)
                passed.push(expr);
            else
                failed.push(expr);
        }
        catch {
            failed.push(expr);
        }
    }
    return { passed, failed };
}
function evalExpr(expr, result) {
    const trimmed = expr.trim();
    if (trimmed.startsWith("equals("))
        return evalEquals(args(trimmed), result);
    if (trimmed.startsWith("in_set("))
        return evalInSet(args(trimmed), result);
    if (trimmed.startsWith("match("))
        return evalMatch(args(trimmed), result);
    if (trimmed.startsWith("date_le("))
        return evalDateLe(args(trimmed), result);
    throw new Error("unsupported expr");
}
function args(call) {
    const inside = call.slice(call.indexOf("(") + 1, call.lastIndexOf(")"));
    // split by commas not in brackets
    const parts = [];
    let depth = 0, cur = "";
    for (const ch of inside) {
        if (ch === '(')
            depth++;
        if (ch === ')')
            depth--;
        if (ch === ',' && depth === 0) {
            parts.push(cur.trim());
            cur = "";
        }
        else {
            if (ch !== ',' || depth > 0)
                cur += ch;
        }
    }
    if (cur.trim())
        parts.push(cur.trim());
    return parts;
}
function resolveValue(token, result) {
    token = token.trim();
    if (token.startsWith("sum(")) {
        const field = token.slice(4, -1).trim();
        const fr = result.fields[field];
        if (!fr || !Array.isArray(fr.value))
            return null;
        return fr.value.reduce((a, b) => a + (Number(b) || 0), 0);
    }
    if (token.startsWith("add(")) {
        const [a, b] = args(token);
        return (Number(resolveValue(a, result)) || 0) + (Number(resolveValue(b, result)) || 0);
    }
    if (/^\d+(\.\d+)?$/.test(token))
        return Number(token);
    if (token.startsWith('"') && token.endsWith('"'))
        return token.slice(1, -1);
    // treat as field name
    const fr = result.fields[token];
    return fr?.value ?? null;
}
function evalEquals(argv, result) {
    const [a, b, tolArg] = argv;
    const va = Number(resolveValue(a, result));
    const vb = Number(resolveValue(b, result));
    const tol = tolArg ? Number(tolArg.split('=')[1]) : 0;
    if (!Number.isFinite(va) || !Number.isFinite(vb))
        return false;
    return Math.abs(va - vb) <= tol;
}
function evalInSet(argv, result) {
    const [x, list] = argv;
    const vx = String(resolveValue(x, result) ?? "");
    const set = JSON.parse(list.replace(/'/g, '"'));
    return set.includes(vx);
}
function evalMatch(argv, result) {
    const [x, rxStr] = argv;
    const vx = String(resolveValue(x, result) ?? "");
    const pat = rxStr.trim().replace(/^"|"$/g, "");
    const rx = new RegExp(pat);
    return rx.test(vx);
}
function evalDateLe(argv, result) {
    const [a, b] = argv;
    const va = new Date(String(resolveValue(a, result)));
    const vb = new Date(String(resolveValue(b, result)));
    return va.getTime() <= vb.getTime();
}
