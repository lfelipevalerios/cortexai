// validar_contra_padroes: checagens heurísticas de código ou descrição contra as
// regras do workspace (componentes Rule, políticas, padrões técnicos e radar).
// Cada violação aponta a regra de origem, o mesmo guardrail visto no Córtex.
import type { WorkspaceData } from '@cortex/schemas';
import { norm, score } from './store.js';

export interface Origin {
  tipo: 'politica' | 'regra' | 'padrao_tecnico' | 'radar' | 'padrao_cortex';
  id: string;
  nome: string;
}

export interface Violation {
  regra: string;
  severidade: 'alta' | 'media' | 'baixa';
  origem: Origin;
  linha?: number;
  trecho?: string;
  sugestao: string;
}

const PII_RE = /\b(cpf|cnpj|e-?mail|email|telefone|celular|rg|cartao|card_?number|numero_?cartao|data_?nascimento|birth_?date)\b/i;
const MASK_RE = /mascar|mask|anonimi|redact|hash|ofusc|pseudonim|\*\*\*/i;
const LOG_RE = /\b(console\.(log|info|warn|error|debug)|logger\.\w+|log\.(info|debug|warn|error|trace)|logging\.\w+|print(ln)?|System\.out\.print\w*|Console\.Write\w*)\s*\(/;
const RESPONSE_RE = /\b(res\.(json|send|write)|NextResponse\.json|Response\.json|reply\.send|ctx\.body\s*=|return\s+Ok\(|jsonify)\s*\(?/;
const SECRET_RE = /\b(api[_-]?key|apikey|secret|client[_-]?secret|password|passwd|senha|token|access[_-]?key)\b["']?\s*[:=]\s*["'`][^"'`\s]{8,}["'`]/i;
const SECRET_LITERAL_RE = /\b(sk-[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{20,}|xox[bp]-[A-Za-z0-9-]{10,})\b/;
const SQL_CONCAT_RE = /\b(query|execute|exec|raw)\s*\(\s*(`[^`]*\$\{|["'][^"']*["']\s*\+)/i;

/** Procura a regra do workspace que melhor explica a violação. */
function findOrigin(ws: WorkspaceData, query: string, fallback: Origin): Origin {
  type Cand = { o: Origin; s: number };
  const cands: Cand[] = [];
  for (const p of ws.policies.filter((p) => p.active)) {
    cands.push({ o: { tipo: 'politica', id: p.id, nome: p.name }, s: score(query, `${p.description} ${p.condition} ${p.code}`, p.name) + 0.2 });
  }
  for (const c of ws.components.filter((c) => c.type === 'rule' && c.status !== 'depreciado')) {
    cands.push({ o: { tipo: 'regra', id: c.id, nome: c.name }, s: score(query, `${c.description} ${c.content}`, c.name) + 0.1 });
  }
  const techAreas = new Set(ws.brainAreas.filter((a) => a.side === 'tecnico').map((a) => a.id));
  for (const a of ws.artifacts.filter((a) => techAreas.has(a.areaId))) {
    cands.push({ o: { tipo: 'padrao_tecnico', id: a.id, nome: a.title }, s: score(query, `${a.summary} ${a.body ?? ''} ${a.tags.join(' ')}`, a.title) });
  }
  cands.sort((a, b) => b.s - a.s);
  return cands[0] && cands[0].s >= 0.6 ? cands[0].o : fallback;
}

function forbiddenStack(ws: WorkspaceData): { name: string; origin: Origin }[] {
  const out: { name: string; origin: Origin }[] = ws.radar
    .filter((r) => r.ring === 'evitar')
    .map((r) => ({ name: r.name, origin: { tipo: 'radar', id: `radar:${r.name}`, nome: `Radar de tecnologia: "${r.name}" está no anel Evitar` } as Origin }));
  // Políticas de stack podem listar itens proibidos no JSON da regra.
  for (const p of ws.policies.filter((p) => p.active && p.kind === 'stack' && p.effect === 'bloquear')) {
    try {
      const code = JSON.parse(p.code) as Record<string, unknown>;
      const walk = (v: unknown, key = '') => {
        if (Array.isArray(v) && /proib|bloq|deny|forbid|evitar|block|nao_permit/i.test(key)) {
          for (const item of v) if (typeof item === 'string') out.push({ name: item, origin: { tipo: 'politica', id: p.id, nome: p.name } });
        } else if (v && typeof v === 'object') {
          for (const [k, child] of Object.entries(v)) walk(child, k);
        }
      };
      walk(code);
    } catch {
      /* código da política não é JSON: ignora */
    }
  }
  return out;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function validate(ws: WorkspaceData, input: { codigo?: string; descricao?: string; caminhoArquivo?: string }) {
  const violations: Violation[] = [];
  const piiFallback: Origin = { tipo: 'padrao_cortex', id: 'cortex-lgpd-pii', nome: 'LGPD: dado pessoal só sai mascarado (padrão Córtex)' };
  const piiOrigin = findOrigin(ws, 'pii dado pessoal cpf email mascarar lgpd log resposta', piiFallback);
  const secretOrigin = findOrigin(ws, 'segredo credencial cofre secret token chave senha', {
    tipo: 'padrao_cortex', id: 'cortex-segredos-cofre', nome: 'Segredos só por referência ao cofre (padrão Córtex)',
  });
  const sqlOrigin = findOrigin(ws, 'sql consulta parametrizada injecao query', {
    tipo: 'padrao_cortex', id: 'cortex-sql-parametrizado', nome: 'Consultas sempre parametrizadas (padrão Córtex)',
  });

  if (input.codigo) {
    const lines = input.codigo.split(/\r?\n/);
    lines.forEach((raw, i) => {
      const line = raw.trim();
      if (!line || line.startsWith('//') || line.startsWith('#') || line.startsWith('*')) return;
      const linha = i + 1;
      const trecho = line.slice(0, 200);
      const hasPii = PII_RE.test(line) && !MASK_RE.test(line);
      if (hasPii && LOG_RE.test(line)) {
        violations.push({ regra: 'Dado pessoal (PII) registrado em log sem mascaramento', severidade: 'alta', origem: piiOrigin, linha, trecho, sugestao: 'Remova o campo do log ou aplique a função de mascaramento (ex.: mascararCpf, mascararEmail) antes de registrar.' });
      }
      if (hasPii && RESPONSE_RE.test(line)) {
        violations.push({ regra: 'Dado pessoal (PII) devolvido na resposta sem mascaramento', severidade: 'alta', origem: piiOrigin, linha, trecho, sugestao: 'Devolva o campo mascarado ou passe a saída pelo guardrail de PII (nó guardrail.pii) antes de responder.' });
      }
      if ((SECRET_RE.test(line) && !/process\.env|os\.environ|getenv|secretRef|vault|cofre/i.test(line)) || SECRET_LITERAL_RE.test(line)) {
        violations.push({ regra: 'Segredo escrito no código', severidade: 'alta', origem: secretOrigin, linha, trecho: trecho.replace(/(["'`])[^"'`]{4}([^"'`]*)\1/g, '$1****$1'), sugestao: 'Leia o segredo do cofre ou de variável de ambiente; o conector guarda só a referência (secretRef).' });
      }
      if (SQL_CONCAT_RE.test(line)) {
        violations.push({ regra: 'SQL montado por concatenação de texto', severidade: 'media', origem: sqlOrigin, linha, trecho, sugestao: 'Use parâmetros ($1, ?, :nome) na consulta.' });
      }
    });
  }

  if (input.descricao) {
    const d = norm(input.descricao);
    const mentionsPii = PII_RE.test(d) || /dado(s)? pesso|pii/.test(d);
    const exposes = /\blog|resposta|whatsapp|enviar|envia|devolv|retorn|exib|mostr/.test(d);
    const protectedByFilter = /mascar|filtro|guardrail|anonimi|ofusc/.test(d);
    if (mentionsPii && exposes && !protectedByFilter) {
      violations.push({ regra: 'Fluxo descrito expõe dado pessoal sem filtro de PII', severidade: 'media', origem: piiOrigin, sugestao: 'Inclua um nó guardrail.pii (Filtro de PII) antes da saída ou mascare os campos.' });
    }
  }

  const text = `${input.codigo ?? ''}\n${input.descricao ?? ''}\n${input.caminhoArquivo ?? ''}`;
  const seen = new Set<string>();
  for (const f of forbiddenStack(ws)) {
    const key = norm(f.name);
    if (!key || seen.has(key)) continue;
    const re = new RegExp(`(^|[^a-z0-9])${escapeRe(key)}([^a-z0-9]|$)`, 'i');
    const lines = norm(text).split('\n');
    const idx = lines.findIndex((l) => re.test(l));
    if (idx >= 0) {
      seen.add(key);
      violations.push({
        regra: `Tecnologia fora da stack aprovada: ${f.name}`,
        severidade: f.origin.tipo === 'politica' ? 'alta' : 'media',
        origem: f.origin,
        linha: input.codigo && idx < (input.codigo.split('\n').length) ? idx + 1 : undefined,
        trecho: lines[idx].trim().slice(0, 200),
        sugestao: 'Substitua por uma tecnologia do anel Adotar do radar ou abra uma proposta de mudança (propor_mudanca).',
      });
    }
  }

  const checked = [
    'PII em logs', 'PII em respostas', 'Segredos no código', 'SQL parametrizado',
    `Stack proibida (${forbiddenStack(ws).length} itens do radar/políticas)`,
    ...(input.descricao ? ['PII no fluxo descrito'] : []),
  ];
  return {
    ok: violations.length === 0,
    arquivo: input.caminhoArquivo,
    resumo: violations.length === 0 ? 'Nenhuma violação encontrada nas checagens.' : `${violations.length} violação(ões) encontrada(s).`,
    checagens: checked,
    violacoes: violations,
  };
}
