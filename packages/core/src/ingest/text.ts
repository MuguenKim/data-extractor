import { DocumentText, IngestOptions } from './types';

export function ingestPlainText(buf: Buffer, opts: IngestOptions): DocumentText {
  const text = buf.toString('utf8');
  const pageMap = [{ page: 1, start: 0, end: text.length }];
  return {
    text,
    pageMap,
    warnings: [],
    meta: { adapter: 'text', mime: opts.mime, filename: opts.filename, bytes: buf.byteLength }
  };
}

