// Extremely lightweight language hinting.
// For proper detection, integrate a library later; keep minimal for dev.
export function detectLanguage(text: string): string {
  const sample = text.slice(0, 2000);
  const hasAccents = /[àâäéèêëïîôöùûüçñ]/i.test(sample);
  const hasCyrillic = /[\u0400-\u04FF]/.test(sample);
  const hasArabic = /[\u0600-\u06FF]/.test(sample);
  if (hasCyrillic) return 'russian';
  if (hasArabic) return 'arabic';
  if (hasAccents) return 'french';
  return 'english';
}
