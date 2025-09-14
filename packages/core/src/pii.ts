// Basic PII masking at storage boundary.

// Masks emails, phone numbers, and IBAN-like strings.
export function maskPII(text: string): string {
  let out = text;
  // Email
  out = out.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, (m) => maskCenter(m));
  // Phone (very loose; 7+ digits possibly separated)
  out = out.replace(/(?<!\d)(?:\+?\d[\s-()]*){7,}(?!\d)/g, (m) => maskDigits(m));
  // IBAN (2 letters + up to 32 alnum)
  out = out.replace(/[A-Z]{2}\d{2}[A-Z0-9]{10,30}/gi, (m) => maskCenter(m));
  return out;
}

function maskCenter(s: string): string {
  if (s.length <= 6) return '*'.repeat(s.length);
  const head = s.slice(0, Math.floor(s.length * 0.3));
  const tail = s.slice(-Math.floor(s.length * 0.2));
  return head + '*'.repeat(s.length - head.length - tail.length) + tail;
}

function maskDigits(s: string): string {
  let digits = 0;
  return s.replace(/\d/g, (d) => (++digits <= 3 || digits > Math.max(3, countDigits(s) - 2) ? d : '*'));
}

function countDigits(s: string): number {
  return (s.match(/\d/g) || []).length;
}

