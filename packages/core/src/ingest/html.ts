import { DocumentText, IngestOptions } from './types';
import { htmlToMarkdown } from './markdown';

export function ingestHTML(buf: Buffer, opts: IngestOptions): DocumentText {
  const raw = buf.toString('utf8');
  const md = htmlToMarkdown(raw);
  const pageMap = [{ page: 1, start: 0, end: md.length }];
  const warnings: string[] = [];
  return {
    text: md,
    pageMap,
    warnings,
    meta: { adapter: 'html', mime: opts.mime, filename: opts.filename, bytes: buf.byteLength }
  };
}

export function ingestHTMLString(html: string, opts: IngestOptions): DocumentText {
  const md = htmlToMarkdown(html);
  const pageMap = [{ page: 1, start: 0, end: md.length }];
  return {
    text: md,
    pageMap,
    warnings: [],
    meta: { adapter: 'url', mime: opts.mime, filename: opts.filename, bytes: Buffer.byteLength(html) }
  };
}
