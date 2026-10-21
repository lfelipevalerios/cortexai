// Utilitários de formatação e mascaramento (pt-BR).

const CNPJ_RE = /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g;
const CPF_RE = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;
const EMAIL_RE = /\b([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*@([A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/g;
const PHONE_RE = /(?:\+?55\s?)?\(?\b\d{2}\)?[\s-]?9?\d{4}[\s-]?\d{4}\b/g;

/** Mascara CPF, CNPJ, e-mail e telefone em um texto livre. */
export function maskPii(value: string): string {
  return value
    .replace(CNPJ_RE, (m) => {
      const d = m.replace(/\D/g, '');
      return `**.***.***/${d.slice(8, 12)}-**`;
    })
    .replace(CPF_RE, (m) => {
      const d = m.replace(/\D/g, '');
      return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
    })
    .replace(EMAIL_RE, (_m, first: string, domain: string) => `${first}***@${domain}`)
    .replace(PHONE_RE, (m) => {
      const d = m.replace(/\D/g, '');
      if (d.length < 10) return m;
      const local = d.slice(-11).length === 11 ? d.slice(-11) : d.slice(-10);
      const ddd = local.slice(0, 2);
      return `(${ddd}) *****-${d.slice(-4)}`;
    });
}

/** Indica se o texto contém algum dado pessoal reconhecível. */
export function containsPii(value: string): boolean {
  return maskPii(value) !== value;
}

const NBSP = / | /g;

export function formatBRL(n: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n).replace(NBSP, ' ');
}

export function formatNumber(n: number, maxFractionDigits = 2): string {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: maxFractionDigits }).format(n).replace(NBSP, ' ');
}

/** "há 3 h", "há 5 min", "ontem", "em 2 d". */
export function relativeTime(iso: string, nowIso?: string): string {
  const t = Date.parse(iso);
  const now = nowIso ? Date.parse(nowIso) : Date.now();
  if (Number.isNaN(t) || Number.isNaN(now)) return '';
  const diffSec = Math.round((now - t) / 1000);
  const future = diffSec < 0;
  const s = Math.abs(diffSec);
  const wrap = (txt: string) => (future ? `em ${txt}` : `há ${txt}`);
  if (s < 60) return 'agora';
  const min = Math.floor(s / 60);
  if (min < 60) return wrap(`${min} min`);
  const h = Math.floor(min / 60);
  if (h < 24) return wrap(`${h} h`);
  const d = Math.floor(h / 24);
  if (d === 1) return future ? 'amanhã' : 'ontem';
  if (d < 30) return wrap(`${d} d`);
  const mo = Math.floor(d / 30);
  if (mo < 12) return wrap(mo === 1 ? '1 mês' : `${mo} meses`);
  const y = Math.floor(d / 365);
  return wrap(y <= 1 ? '1 ano' : `${y} anos`);
}
