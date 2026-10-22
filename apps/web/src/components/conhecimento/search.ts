import type { KnowledgeDocument, RetrievalExample } from '@cortex/schemas';

export interface RetrievedChunk {
  doc: KnowledgeDocument;
  chunkIndex: number;
  text: string;
  score: number;
}

export interface RetrievalResult {
  question: string;
  answer: string | null;
  chunks: RetrievedChunk[];
  /** true quando veio da pergunta roteirizada; false = busca por palavras-chave. */
  scripted: boolean;
}

export const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const STOP = new Set([
  'a', 'o', 'as', 'os', 'de', 'da', 'do', 'das', 'dos', 'e', 'em', 'no', 'na', 'nos', 'nas', 'um', 'uma', 'para', 'por', 'com',
  'que', 'qual', 'quais', 'se', 'ao', 'aos', 'e', 'como', 'quando', 'precisa', 'ha', 'ser', 'sao', 'meu', 'minha', 'cliente',
]);

export const tokens = (s: string) => normalize(s).split(' ').filter((t) => t.length > 2 && !STOP.has(t));

/** Pergunta roteirizada que corresponde (igual, contida ou com alta sobreposição de palavras). */
function matchScripted(q: string, retrievals: RetrievalExample[]): RetrievalExample | undefined {
  const nq = normalize(q);
  if (!nq) return undefined;
  const exact = retrievals.find((r) => normalize(r.question) === nq);
  if (exact) return exact;
  const contains = retrievals.find((r) => {
    const nr = normalize(r.question);
    return (nr.includes(nq) && nq.length >= 12) || nq.includes(nr);
  });
  if (contains) return contains;
  const tq = new Set(tokens(q));
  let best: { r: RetrievalExample; s: number } | undefined;
  for (const r of retrievals) {
    const tr = tokens(r.question);
    if (!tr.length) continue;
    const hit = tr.filter((t) => tq.has(t)).length;
    const s = hit / Math.max(tr.length, tq.size);
    if (!best || s > best.s) best = { r, s };
  }
  return best && best.s >= 0.6 ? best.r : undefined;
}

export function retrieve(q: string, retrievals: RetrievalExample[], documents: KnowledgeDocument[]): RetrievalResult {
  const scripted = matchScripted(q, retrievals);
  if (scripted) {
    const chunks = scripted.results
      .map((r) => {
        const doc = documents.find((d) => d.id === r.docId);
        return doc ? { doc, chunkIndex: r.chunkIndex, text: doc.chunks[r.chunkIndex] ?? '', score: r.score } : null;
      })
      .filter((x): x is RetrievedChunk => !!x);
    return { question: q, answer: scripted.answer, chunks, scripted: true };
  }
  const tq = tokens(q);
  if (!tq.length) return { question: q, answer: null, chunks: [], scripted: false };
  const scored: RetrievedChunk[] = [];
  for (const doc of documents) {
    if (doc.status !== 'processado') continue;
    doc.chunks.forEach((text, i) => {
      const tc = new Set(tokens(text + ' ' + doc.title));
      // Prefixo de 5 letras aproxima plural e flexões ("trocas" ~ "troca").
      const pref = new Set([...tc].map((t) => t.slice(0, 5)));
      const hit = tq.filter((t) => tc.has(t) || pref.has(t.slice(0, 5))).length;
      if (hit) scored.push({ doc, chunkIndex: i, text, score: Math.min(0.89, 0.35 + 0.55 * (hit / tq.length)) });
    });
  }
  scored.sort((a, b) => b.score - a.score);
  return { question: q, answer: null, chunks: scored.slice(0, 3), scripted: false };
}

/** Divide um texto em trechos por parágrafo, agrupando até ~maxChars. */
export function chunkText(text: string, maxChars = 600): string[] {
  const paras = text.split(/\n\s*\n/).map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const out: string[] = [];
  let cur = '';
  for (const p of paras) {
    if (p.length > maxChars) {
      if (cur) out.push(cur);
      cur = '';
      for (let i = 0; i < p.length; i += maxChars) out.push(p.slice(i, i + maxChars));
      continue;
    }
    if ((cur + ' ' + p).trim().length > maxChars) {
      out.push(cur);
      cur = p;
    } else cur = (cur + ' ' + p).trim();
  }
  if (cur) out.push(cur);
  return out;
}
