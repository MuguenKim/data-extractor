import { ingestHTML, ingestHTMLString } from './html';
import { ingestPlainText } from './text';
import { ingestCSV } from './csv';
import { ingestPlaceholder } from './placeholders';
import { DocumentText, IngestOptions } from './types';
import { getLogger } from '../logger';
import { detectLanguage } from '../lang';
import { ingestEML, ingestMSG, ingestMHTML } from './email';
import { ingestSpreadsheet } from './spreadsheet';
import { ingestPDF } from './pdf';
import { ingestDOCX, ingestDOC } from './doc';
import { ingestImage } from './image';
import { ingestPresentation } from './presentation';

export function guessAdapter(filename?: string, mime?: string): string {
  const ext = (filename || '').toLowerCase();
  const m = (mime || '').toLowerCase();
  if (m.includes('text/html') || ext.endsWith('.html') || ext.endsWith('.htm')) return 'html';
  if (m.includes('multipart/related') || ext.endsWith('.mhtml') || ext.endsWith('.mht')) return 'mhtml';
  if (m.includes('message/rfc822') || ext.endsWith('.eml')) return 'eml';
  if (ext.endsWith('.msg')) return 'msg';
  if (m.includes('text/csv') || ext.endsWith('.csv')) return 'csv';
  if (ext.endsWith('.xlsx') || ext.endsWith('.xls') || ext.endsWith('.ods')) return 'spreadsheet';
  if (m.includes('text/plain') || ext.endsWith('.txt') || ext.endsWith('.log')) return 'text';
  if (ext.endsWith('.pdf') || m.includes('application/pdf')) return 'pdf';
  if (ext.endsWith('.docx')) return 'docx';
  if (ext.endsWith('.doc') || m.includes('application/msword')) return 'doc';
  if (ext.endsWith('.pptx') || ext.endsWith('.odp') || m.includes('application/vnd.openxmlformats-officedocument.presentationml.presentation')) return 'presentation';
  if (m.startsWith('image/') || /(png|jpg|jpeg|tif|tiff|bmp|gif|webp|heic)$/i.test(ext)) return 'image';
  return 'text';
}

export function ingestFromText(text: string, opts: IngestOptions = {}): DocumentText {
  const log = getLogger('core').child({});
  const pageMap = [{ page: 1, start: 0, end: text.length }];
  const doc = { text, pageMap, warnings: [], meta: { adapter: 'text', mime: opts.mime, filename: opts.filename, bytes: Buffer.byteLength(text) } } as DocumentText;
  log.debug('ingestFromText', { adapter: 'text', filename: opts.filename, mime: opts.mime, bytes: doc.meta?.bytes, pages: pageMap.length });
  return doc;
}

export function ingestBuffer(buf: Buffer, opts: IngestOptions = {}): DocumentText {
  const log = getLogger('core').child({});
  const adapter = guessAdapter(opts.filename, opts.mime);
  let doc: DocumentText;
  switch (adapter) {
    case 'html':
      doc = ingestHTML(buf, opts);
      break;
    case 'mhtml':
      doc = ingestMHTML(buf, opts);
      break;
    case 'eml':
      doc = ingestEML(buf, opts);
      break;
    case 'msg':
      // Sync path uses placeholder/basic MSG; async variant available in ingestBufferAsync
      doc = ingestMSG(buf, opts);
      break;
    case 'csv':
      doc = ingestCSV(buf, opts);
      break;
    case 'spreadsheet':
      doc = ingestSpreadsheet(buf, opts);
      break;
    case 'text':
      doc = ingestPlainText(buf, opts);
      break;
    case 'pdf':
      doc = ingestPDF(buf, opts);
      break;
    case 'docx':
      doc = ingestDOCX(buf, opts);
      break;
    case 'doc':
      doc = ingestDOC(buf, opts);
      break;
    case 'presentation':
      doc = ingestPresentation(buf, opts);
      break;
    case 'image':
      doc = ingestImage(buf, opts);
      break;
    default:
      doc = ingestPlainText(buf, opts);
  }

  // Language hint
  const lang = opts.languageHint || detectLanguage(doc.text || '');
  doc.language = lang;

  // PII Policy: do not mask. Preserve text exactly as provided.
  log.info('ingestBuffer.complete', { adapter, filename: opts.filename, mime: opts.mime, bytes: buf.byteLength, pages: doc.pageMap?.length, warnings: (doc.warnings||[]).length, language: lang });
  return doc;
}

// Async variant for adapters that require async libs (pdfjs, mammoth, unzipper)
export async function ingestBufferAsync(buf: Buffer, opts: IngestOptions = {}): Promise<DocumentText> {
  const log = getLogger('core').child({});
  const adapter = guessAdapter(opts.filename, opts.mime);
  let doc: DocumentText;
  switch (adapter) {
    case 'html':
      doc = ingestHTML(buf, opts);
      break;
    case 'mhtml':
      doc = ingestMHTML(buf, opts);
      break;
    case 'eml':
      doc = ingestEML(buf, opts);
      break;
    case 'msg':
      doc = await import('./email').then(m => (m as any).ingestMSGAsync ? (m as any).ingestMSGAsync(buf, opts) : m.ingestMSG(buf, opts));
      break;
    case 'csv':
      doc = ingestCSV(buf, opts);
      break;
    case 'spreadsheet':
      doc = ingestSpreadsheet(buf, opts);
      break;
    case 'text':
      doc = ingestPlainText(buf, opts);
      break;
    case 'pdf':
      doc = await import('./pdf').then(m => m.ingestPDFAsync ? m.ingestPDFAsync(buf, opts) : m.ingestPDF(buf, opts));
      break;
    case 'docx':
      doc = await import('./doc').then(m => m.ingestDOCXAsync ? m.ingestDOCXAsync(buf, opts) : m.ingestDOCX(buf, opts));
      break;
    case 'doc':
      doc = ingestDOC(buf, opts);
      break;
    case 'presentation':
      doc = await import('./presentation').then(m => (m as any).ingestPresentationAsync ? (m as any).ingestPresentationAsync(buf, opts) : m.ingestPresentation(buf, opts));
      break;
    case 'image':
      doc = await import('./image').then(m => (m as any).ingestImageAsync ? (m as any).ingestImageAsync(buf, opts) : m.ingestImage(buf, opts));
      break;
    default:
      doc = ingestPlainText(buf, opts);
  }

  const lang = opts.languageHint || detectLanguage(doc.text || '');
  doc.language = lang;
  // PII Policy: do not mask. Preserve text exactly as provided.
  log.info('ingestBufferAsync.complete', { adapter, filename: opts.filename, mime: opts.mime, bytes: buf.byteLength, pages: doc.pageMap?.length, warnings: (doc.warnings||[]).length, language: lang });
  return doc;
}

export type { DocumentText, IngestOptions } from './types';
