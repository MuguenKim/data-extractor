import { DocumentText, IngestOptions } from './types';

function parseCSV(text: string): string[][] {
  // Naive CSV parser: handles quotes and commas minimally.
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else {
        field += c;
      }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { cur.push(field); field = ''; }
      else if (c === '\n') { cur.push(field); field = ''; rows.push(cur); cur = []; }
      else if (c === '\r') { /* ignore */ }
      else { field += c; }
    }
  }
  cur.push(field);
  rows.push(cur);
  return rows;
}

export function ingestCSV(buf: Buffer, opts: IngestOptions): DocumentText {
  const raw = buf.toString('utf8');
  const rows = parseCSV(raw);
  const lines = rows.map((r) => r.join('\t'));
  const text = lines.join('\n');
  const pageMap = [{ page: 1, start: 0, end: text.length }];
  return {
    text,
    pageMap,
    warnings: [],
    meta: { adapter: 'csv', mime: opts.mime, filename: opts.filename, bytes: buf.byteLength }
  };
}

