import { DocumentText, IngestOptions } from './types';

export function ingestPresentation(_buf: Buffer, opts: IngestOptions): DocumentText {
  // PPTX/ODP require ZIP/XML parsing. Placeholder only in dev.
  const warnings = ['Presentation parsing not implemented in dev; route to worker (unzip XML and read slide text boxes).'];
  return {
    text: '',
    pageMap: [{ page: 1, start: 0, end: 0 }],
    warnings,
    meta: { adapter: 'presentation', mime: opts.mime, filename: opts.filename, bytes: 0 }
  };
}

export async function ingestPresentationAsync(buf: Buffer, opts: IngestOptions): Promise<DocumentText> {
  const unzipper = await import('unzipper');
  const { XMLParser } = await import('fast-xml-parser');
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
  const directory = await (unzipper as any).Open.buffer(buf);
  const slides = directory.files.filter((f: any) => /^ppt\/slides\/slide\d+\.xml$/.test(f.path));
  slides.sort((a: any, b: any) => a.path.localeCompare(b.path));
  let text = '';
  const notes: string[] = [];
  let slideIndex = 0;
  for (const file of slides) {
    slideIndex++;
    const content = await file.buffer();
    const xml = content.toString('utf8');
    const json = parser.parse(xml);
    // a:t nodes contain text
    const slideText: string[] = [];
    const collect = (node: any) => {
      if (!node || typeof node !== 'object') return;
      for (const [k, v] of Object.entries(node)) {
        if (k.endsWith('t') && typeof v === 'string') slideText.push(v);
        else if (typeof v === 'object') collect(v);
      }
    };
    collect(json);
    const joined = slideText.join('\n');
    text += (slideIndex > 1 ? '\n\n' : '') + `Slide ${slideIndex}:\n` + joined;
  }
  notes.push(`slides=${slideIndex}`);
  return {
    text,
    pageMap: [{ page: 1, start: 0, end: text.length }],
    warnings: [],
    meta: { adapter: 'presentation', mime: opts.mime, filename: opts.filename, bytes: buf.byteLength, notes }
  };
}
