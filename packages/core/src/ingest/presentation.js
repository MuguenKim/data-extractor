"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ingestPresentation = ingestPresentation;
exports.ingestPresentationAsync = ingestPresentationAsync;
function ingestPresentation(_buf, opts) {
    // PPTX/ODP require ZIP/XML parsing. Placeholder only in dev.
    const warnings = ['Presentation parsing not implemented in dev; route to worker (unzip XML and read slide text boxes).'];
    return {
        text: '',
        pageMap: [{ page: 1, start: 0, end: 0 }],
        warnings,
        meta: { adapter: 'presentation', mime: opts.mime, filename: opts.filename, bytes: 0 }
    };
}
async function ingestPresentationAsync(buf, opts) {
    const unzipper = await Promise.resolve().then(() => __importStar(require('unzipper')));
    const { XMLParser } = await Promise.resolve().then(() => __importStar(require('fast-xml-parser')));
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
    const directory = await unzipper.Open.buffer(buf);
    const slides = directory.files.filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f.path));
    slides.sort((a, b) => a.path.localeCompare(b.path));
    let text = '';
    const notes = [];
    let slideIndex = 0;
    for (const file of slides) {
        slideIndex++;
        const content = await file.buffer();
        const xml = content.toString('utf8');
        const json = parser.parse(xml);
        // a:t nodes contain text
        const slideText = [];
        const collect = (node) => {
            if (!node || typeof node !== 'object')
                return;
            for (const [k, v] of Object.entries(node)) {
                if (k.endsWith('t') && typeof v === 'string')
                    slideText.push(v);
                else if (typeof v === 'object')
                    collect(v);
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
