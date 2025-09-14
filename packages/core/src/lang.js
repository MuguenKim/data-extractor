"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectLanguage = detectLanguage;
// Extremely lightweight language hinting.
// For proper detection, integrate a library later; keep minimal for dev.
function detectLanguage(text) {
    const sample = text.slice(0, 2000);
    const hasAccents = /[àâäéèêëïîôöùûüçñ]/i.test(sample);
    const hasCyrillic = /[\u0400-\u04FF]/.test(sample);
    const hasArabic = /[\u0600-\u06FF]/.test(sample);
    if (hasCyrillic)
        return 'russian';
    if (hasArabic)
        return 'arabic';
    if (hasAccents)
        return 'french';
    return 'english';
}
