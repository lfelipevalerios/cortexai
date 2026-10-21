// Gerador pseudoaleatório determinístico (mulberry32) e utilitários de dados sintéticos.
// Nunca usar Math.random nem Date.now: a mesma semente gera sempre os mesmos dados.

export interface Rng {
  next(): number;
  int(min: number, max: number): number;
  float(min: number, max: number, decimals?: number): number;
  pick<T>(arr: readonly T[]): T;
  chance(p: number): boolean;
}

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    float: (min, max, decimals = 2) => round(min + next() * (max - min), decimals),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    chance: (p) => next() < p,
  };
}

export function round(n: number, decimals = 2): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

export function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// ---------- Nomes fictícios ----------
export const FIRST_NAMES = [
  'Ana', 'Beatriz', 'Bruno', 'Camila', 'Carlos', 'Daniela', 'Eduardo', 'Fernanda', 'Gabriel', 'Helena',
  'Igor', 'Juliana', 'Larissa', 'Lucas', 'Marcos', 'Mariana', 'Natália', 'Otávio', 'Patrícia', 'Rafael',
  'Renata', 'Rodrigo', 'Sabrina', 'Thiago', 'Vanessa', 'Vinícius', 'Aline', 'Caio', 'Débora', 'Felipe',
];
export const LAST_NAMES = [
  'Almeida', 'Barbosa', 'Cardoso', 'Carvalho', 'Costa', 'Duarte', 'Ferraz', 'Gomes', 'Lacerda', 'Machado',
  'Moreira', 'Nogueira', 'Pacheco', 'Prado', 'Queiroz', 'Rezende', 'Siqueira', 'Teixeira', 'Valença', 'Xavier',
];
export const CITIES: [string, string][] = [
  ['São Paulo', 'SP'], ['Campinas', 'SP'], ['Rio de Janeiro', 'RJ'], ['Belo Horizonte', 'MG'], ['Curitiba', 'PR'],
  ['Porto Alegre', 'RS'], ['Salvador', 'BA'], ['Recife', 'PE'], ['Fortaleza', 'CE'], ['Goiânia', 'GO'],
];

// ---------- Documentos com dígito verificador válido ----------
function cpfDigits(rng: Rng): number[] {
  const d = Array.from({ length: 9 }, () => rng.int(0, 9));
  for (const len of [9, 10]) {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += d[i] * (len + 1 - i);
    const r = (sum * 10) % 11;
    d.push(r === 10 ? 0 : r);
  }
  return d;
}

/** CPF válido no formato, já mascarado: "***.482.913-**". */
export function maskedCpf(rng: Rng): string {
  const d = cpfDigits(rng).join('');
  return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
}

/** CNPJ fictício com dígitos verificadores válidos, formatado. */
export function cnpj(rng: Rng): string {
  const d = [...Array.from({ length: 8 }, () => rng.int(0, 9)), 0, 0, 0, 1];
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  for (const w of [w1, w2]) {
    const sum = w.reduce((acc, wi, i) => acc + wi * d[i], 0);
    const r = sum % 11;
    d.push(r < 2 ? 0 : 11 - r);
  }
  const s = d.join('');
  return `${s.slice(0, 2)}.${s.slice(2, 5)}.${s.slice(5, 8)}/${s.slice(8, 12)}-${s.slice(12)}`;
}

export function maskName(full: string): string {
  const [first, ...rest] = full.split(' ');
  const last = rest[rest.length - 1] ?? '';
  return last ? `${first} ${last[0]}${'*'.repeat(Math.max(3, last.length - 1))}` : first;
}

export function maskEmail(full: string): string {
  const user = full
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(' ')[0];
  return `${user.slice(0, 2)}***@email.com.br`;
}
