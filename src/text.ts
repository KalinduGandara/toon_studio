// Pure text helpers (unit-tested in Node).

/** Split text into chunks of at most `maxWords`, breaking after punctuation when possible. */
export function captionChunks(text: string, maxWords: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let cur: string[] = [];
  for (const w of words) {
    cur.push(w);
    if (cur.length >= maxWords || /[.!?,;:]$/.test(w)) {
      out.push(cur.join(' '));
      cur = [];
    }
  }
  if (cur.length) out.push(cur.join(' '));
  return out;
}
