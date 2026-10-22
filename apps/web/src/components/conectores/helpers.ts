// Utilitários do módulo Conectores: ícones, rótulos, máscaras, amostras e impacto.
import {
  Users, Factory, Database, Warehouse, Braces, Zap, FolderOpen, Ticket, Plug, Layers, type LucideIcon,
} from 'lucide-react';
import type {
  AuthMethod, Connector, ConnectorCategory, ConnectorTool, ConnectorType, DiscoveredField, DiscoveredObject,
  IndustryId, SyncMode, WorkspaceData,
} from '@cortex/schemas';
import { maskPii } from '@cortex/engine';

export const PREFIX: Record<IndustryId, string> = { saude: 'sau', varejo: 'var', financeiro: 'fin', telecom: 'tel' };

export const CATEGORY_ICON: Record<ConnectorCategory, LucideIcon> = {
  crm: Users,
  erp: Factory,
  banco: Database,
  plataforma_dados: Warehouse,
  api: Braces,
  eventos: Zap,
  arquivos: FolderOpen,
  itsm: Ticket,
  mcp: Plug,
  setorial: Layers,
};

export const AUTH_LABEL: Record<AuthMethod, string> = {
  oauth2: 'OAuth 2.0',
  api_key: 'Chave de API',
  usuario_senha: 'Usuário e senha',
  certificado: 'Certificado',
};

export const SYNC_LABEL: Record<SyncMode, string> = {
  cdc: 'Tempo real (CDC)',
  agendado: 'Agendado',
  sob_demanda: 'Sob demanda',
};

export const BADGE_TONE: Record<ConnectorType['badge'], 'purple' | 'lilac' | 'green'> = {
  Nativo: 'purple',
  OpenAPI: 'lilac',
  MCP: 'green',
};

/** Hash determinístico (para tempos e séries plausíveis e estáveis). */
export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function pick(seed: string, min: number, max: number): number {
  return min + (hash(seed) % (max - min + 1));
}

export function secretRefFor(wsId: string, connId: string, env: string) {
  return `kv://cortex/${wsId}/${connId}/${env}`;
}

// ---------- Máscara de PII ----------
/** Mascara um valor de campo marcado como PII (CPF, e-mail, telefone, nome, data). */
export function maskValue(v: string | number | boolean | null, pii?: boolean): string {
  if (v === null || v === undefined) return '—';
  const s = String(v);
  if (!pii) return s;
  if (s.includes('*')) return s;
  const m = maskPii(s);
  if (m !== s) return m;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return `${s.slice(0, 4)}-**-**`;
  const words = s.split(/\s+/).filter(Boolean);
  if (words.length > 1) return `${words[0]} ${words[1][0]}******`;
  return s.length <= 2 ? '**' : `${s.slice(0, 2)}${'*'.repeat(Math.min(8, s.length - 2))}`;
}

/** Completa a amostra até n linhas, variando ids e números de forma determinística. */
export function expandSample(rows: DiscoveredObject['sample'], n = 10): DiscoveredObject['sample'] {
  if (rows.length === 0 || rows.length >= n) return rows.slice(0, n);
  const out = [...rows];
  for (let i = rows.length; i < n; i++) {
    const base = rows[i % rows.length];
    const row: Record<string, string | number | boolean | null> = {};
    for (const [k, v] of Object.entries(base)) {
      if (typeof v === 'number') {
        const f = 0.7 + ((hash(`${k}${i}`) % 60) / 100);
        row[k] = Number.isInteger(v) ? Math.max(0, Math.round(v * f)) : Math.round(v * f * 100) / 100;
      } else if (typeof v === 'string' && !v.includes('*') && /\d{3,}/.test(v) && !/^\d{4}-\d{2}-\d{2}/.test(v)) {
        row[k] = v.replace(/(\d{3,})(?!.*\d{3,})/, (d) => String((Number(d) + i * 137) % 10 ** d.length).padStart(d.length, '0'));
      } else if (typeof v === 'boolean') {
        row[k] = hash(`${k}${i}`) % 4 === 0 ? !v : v;
      } else {
        row[k] = v;
      }
    }
    out.push(row);
  }
  return out;
}

// ---------- Objetos genéricos para conectores criados na demo ----------
type Gen = 'id' | 'nome' | 'email' | 'telefone' | 'cpf' | 'texto' | 'status' | 'valor' | 'data' | 'int' | 'bool';
type GF = [string, string, Gen, string?];

const GENERIC: Record<ConnectorCategory, { name: string; kind: DiscoveredObject['kind']; records: number; fields: GF[] }[]> = {
  crm: [
    { name: 'Conta', kind: 'objeto', records: 48200, fields: [['id', 'string', 'id', 'AC-'], ['razao_social', 'string', 'texto', 'Conta'], ['segmento', 'string', 'status', 'PME|Corporativo|Varejo'], ['criada_em', 'date', 'data']] },
    { name: 'Contato', kind: 'objeto', records: 131500, fields: [['id', 'string', 'id', 'CT-'], ['nome', 'string', 'nome'], ['email', 'string', 'email'], ['telefone', 'string', 'telefone'], ['conta_id', 'string', 'id', 'AC-']] },
    { name: 'Caso', kind: 'objeto', records: 402900, fields: [['id', 'string', 'id', 'CS-'], ['contato_id', 'string', 'id', 'CT-'], ['assunto', 'string', 'status', 'Dúvida|Reclamação|Solicitação'], ['status', 'string', 'status', 'Aberto|Resolvido|Em andamento'], ['aberto_em', 'date', 'data']] },
  ],
  erp: [
    { name: 'Pedido de venda', kind: 'objeto', records: 812000, fields: [['pedido_id', 'string', 'id', 'PV-'], ['cliente_cnpj', 'string', 'cpf'], ['valor', 'decimal', 'valor'], ['status', 'string', 'status', 'Aberto|Faturado|Cancelado'], ['emitido_em', 'date', 'data']] },
    { name: 'Nota fiscal', kind: 'objeto', records: 640300, fields: [['nf_id', 'string', 'id', 'NF-'], ['pedido_id', 'string', 'id', 'PV-'], ['valor_total', 'decimal', 'valor'], ['emitida_em', 'date', 'data']] },
    { name: 'Material', kind: 'objeto', records: 22100, fields: [['codigo', 'string', 'id', 'MT-'], ['descricao', 'string', 'texto', 'Item'], ['estoque', 'integer', 'int']] },
  ],
  banco: [
    { name: 'public.clientes', kind: 'tabela', records: 254300, fields: [['cliente_id', 'bigint', 'int'], ['nome', 'varchar', 'nome'], ['cpf', 'varchar', 'cpf'], ['email', 'varchar', 'email'], ['criado_em', 'timestamp', 'data']] },
    { name: 'public.pedidos', kind: 'tabela', records: 1983000, fields: [['pedido_id', 'bigint', 'int'], ['cliente_id', 'bigint', 'int'], ['valor', 'numeric', 'valor'], ['status', 'varchar', 'status', 'novo|pago|enviado|entregue']] },
  ],
  plataforma_dados: [
    { name: 'analytics.fato_vendas', kind: 'tabela', records: 18400000, fields: [['data', 'date', 'data'], ['loja_id', 'string', 'id', 'LJ-'], ['receita', 'decimal', 'valor'], ['itens', 'integer', 'int']] },
    { name: 'analytics.dim_cliente', kind: 'tabela', records: 912000, fields: [['cliente_id', 'string', 'id', 'CL-'], ['nome', 'string', 'nome'], ['segmento', 'string', 'status', 'A|B|C'], ['ativo', 'boolean', 'bool']] },
  ],
  api: [
    { name: 'GET /recursos', kind: 'endpoint', records: 34000, fields: [['id', 'string', 'id', 'RC-'], ['descricao', 'string', 'texto', 'Recurso'], ['status', 'string', 'status', 'ativo|inativo'], ['atualizado_em', 'date', 'data']] },
    { name: 'GET /clientes/{id}', kind: 'endpoint', records: 120000, fields: [['id', 'string', 'id', 'CL-'], ['nome', 'string', 'nome'], ['email', 'string', 'email']] },
  ],
  eventos: [
    { name: 'pedidos.criados', kind: 'objeto', records: 2400000, fields: [['evento_id', 'string', 'id', 'EV-'], ['pedido_id', 'string', 'id', 'PV-'], ['valor', 'decimal', 'valor'], ['ocorrido_em', 'date', 'data']] },
    { name: 'clientes.atualizados', kind: 'objeto', records: 380000, fields: [['evento_id', 'string', 'id', 'EV-'], ['cliente_id', 'string', 'id', 'CL-'], ['email', 'string', 'email']] },
  ],
  arquivos: [
    { name: 'Políticas e procedimentos', kind: 'objeto', records: 1240, fields: [['arquivo', 'string', 'texto', 'Documento'], ['tipo', 'string', 'status', 'PDF|DOCX|PPTX'], ['tamanho_kb', 'integer', 'int'], ['modificado_em', 'date', 'data']] },
    { name: 'Contratos assinados', kind: 'objeto', records: 8600, fields: [['arquivo', 'string', 'texto', 'Contrato'], ['signatario', 'string', 'nome'], ['assinado_em', 'date', 'data']] },
  ],
  itsm: [
    { name: 'Incidente', kind: 'objeto', records: 96400, fields: [['numero', 'string', 'id', 'INC'], ['titulo', 'string', 'texto', 'Falha'], ['prioridade', 'string', 'status', 'P1|P2|P3|P4'], ['solicitante', 'string', 'nome'], ['aberto_em', 'date', 'data']] },
    { name: 'Requisição', kind: 'objeto', records: 41200, fields: [['numero', 'string', 'id', 'REQ'], ['item', 'string', 'texto', 'Acesso'], ['status', 'string', 'status', 'aberta|aprovada|entregue']] },
  ],
  mcp: [
    { name: 'tools/list', kind: 'endpoint', records: 12, fields: [['tool', 'string', 'texto', 'ferramenta'], ['descricao', 'string', 'texto', 'Descrição'], ['escrita', 'boolean', 'bool']] },
  ],
  setorial: [
    { name: 'Registros do setor', kind: 'objeto', records: 210000, fields: [['id', 'string', 'id', 'RG-'], ['titular', 'string', 'nome'], ['documento', 'string', 'cpf'], ['status', 'string', 'status', 'ativo|encerrado'], ['data', 'date', 'data']] },
    { name: 'Transações', kind: 'objeto', records: 1450000, fields: [['id', 'string', 'id', 'TX-'], ['registro_id', 'string', 'id', 'RG-'], ['valor', 'decimal', 'valor'], ['data', 'date', 'data']] },
  ],
};

const FIRST = ['Mariana', 'João', 'Patrícia', 'Rafael', 'Camila', 'Lucas', 'Fernanda', 'Bruno', 'Aline', 'Diego'];
const LAST = ['Souza', 'Oliveira', 'Lima', 'Pereira', 'Costa', 'Ribeiro', 'Martins', 'Gomes', 'Araújo', 'Rocha'];
const PII_GEN = new Set<Gen>(['nome', 'email', 'telefone', 'cpf']);

function genValue(g: Gen, extra: string | undefined, seed: string, i: number): string | number | boolean {
  const h = hash(`${seed}:${i}`);
  switch (g) {
    case 'id': return `${extra ?? ''}${String(100000 + (h % 899999)).slice(0, 6)}`;
    case 'nome': return `${FIRST[h % FIRST.length]} ${LAST[(h >> 4) % LAST.length]}`;
    case 'email': return `${FIRST[h % FIRST.length].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')}.${LAST[(h >> 4) % LAST.length].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')}@exemplo.com.br`;
    case 'telefone': return `(11) 9${String(1000 + (h % 8999))}-${String(1000 + ((h >> 8) % 8999))}`;
    case 'cpf': {
      const d = String(100000000 + (h % 899999999)).padStart(9, '0');
      return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${String(h % 100).padStart(2, '0')}`;
    }
    case 'texto': return `${extra ?? 'Item'} ${1 + (h % 90)}`;
    case 'status': { const opts = (extra ?? 'ativo').split('|'); return opts[h % opts.length]; }
    case 'valor': return Math.round((50 + (h % 500000) / 10) * 100) / 100;
    case 'data': return `2026-${String(1 + (h % 10)).padStart(2, '0')}-${String(1 + ((h >> 3) % 28)).padStart(2, '0')}`;
    case 'int': return 1 + (h % 5000);
    case 'bool': return h % 3 !== 0;
  }
}

export function genericObjects(type: ConnectorType): DiscoveredObject[] {
  return GENERIC[type.category].map((spec) => {
    const fields: DiscoveredField[] = spec.fields.map(([name, t, g]) => (PII_GEN.has(g) ? { name, type: t, pii: true } : { name, type: t }));
    const sample = Array.from({ length: 10 }, (_, i) =>
      Object.fromEntries(spec.fields.map(([name, , g, extra]) => [name, genValue(g, extra, `${type.id}.${spec.name}.${name}`, i)])),
    );
    return { name: spec.name, kind: spec.kind, records: spec.records + (hash(type.id + spec.name) % 9000), fields, sample };
  });
}

export function genericTools(p: string, connId: string, objects: DiscoveredObject[]): ConnectorTool[] {
  const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const out: ConnectorTool[] = [];
  objects.slice(0, 2).forEach((o, i) => {
    const s = slug(o.name.replace(/^(GET|POST)\s+/, '').replace(/^public\.|^analytics\./, ''));
    out.push({ id: `${p}-tl-${connId.replace(`${p}-`, '')}-c${i}`, name: `consultar_${s}`, description: `Consulta registros de ${o.name}.`, mode: 'leitura', enabledByEnv: { dev: true, hml: true, prd: true } });
    if (i === 0) out.push({ id: `${p}-tl-${connId.replace(`${p}-`, '')}-w${i}`, name: `criar_${s}`, description: `Cria um registro em ${o.name}.`, mode: 'escrita', enabledByEnv: { dev: true, hml: true, prd: false } });
  });
  return out;
}

// ---------- Teste de conexão ----------
export type CheckKey = 'rede' | 'autenticacao' | 'permissao' | 'latencia';
export const CHECKS: { key: CheckKey; label: string }[] = [
  { key: 'rede', label: 'Rede' },
  { key: 'autenticacao', label: 'Autenticação' },
  { key: 'permissao', label: 'Permissão' },
  { key: 'latencia', label: 'Latência' },
];

export interface CheckResult {
  key: CheckKey;
  status: 'pendente' | 'rodando' | 'ok' | 'falha';
  ms?: number;
  detail?: string;
  cause?: string;
  fix?: string;
}

/** Resultado determinístico das 4 checagens para um endereço e credencial. */
export function planChecks(endpoint: string, hasSecret: boolean, baseLatency?: number): CheckResult[] {
  const ep = endpoint.trim();
  const out: CheckResult[] = [];
  const schemeOk = /^[a-z][a-z0-9+.-]*:\/\//i.test(ep);
  const insecure = /^http:\/\//i.test(ep);
  if (!ep || !schemeOk || insecure) {
    out.push({
      key: 'rede', status: 'falha', ms: pick(`${ep}rede`, 1200, 3000),
      cause: !ep ? 'Nenhum endereço informado.' : insecure ? 'O endereço usa http:// sem TLS; o Córtex só aceita conexões cifradas.' : `Não foi possível resolver "${ep}": o endereço não tem protocolo (ex.: https://).`,
      fix: 'Volte ao passo 2 e informe o endereço completo começando com https://.',
    });
    return [...out, ...CHECKS.slice(1).map((c) => ({ key: c.key, status: 'pendente' as const }))];
  }
  const host = ep.replace(/^[a-z+.-]+:\/\//i, '').split(/[/:]/)[0];
  out.push({ key: 'rede', status: 'ok', ms: pick(`${ep}rede`, 38, 92), detail: `${host} respondeu com TLS 1.3` });
  if (!hasSecret) {
    out.push({ key: 'autenticacao', status: 'falha', ms: pick(`${ep}auth`, 90, 180), cause: 'Nenhuma credencial no cofre para este ambiente.', fix: 'No passo 2, informe a credencial e clique em "Enviar ao cofre".' });
    return [...out, ...CHECKS.slice(2).map((c) => ({ key: c.key, status: 'pendente' as const }))];
  }
  out.push({ key: 'autenticacao', status: 'ok', ms: pick(`${ep}auth`, 140, 260), detail: 'Token emitido a partir da referência do cofre' });
  out.push({ key: 'permissao', status: 'ok', ms: pick(`${ep}perm`, 60, 140), detail: 'Escopos de leitura e escrita confirmados' });
  const lat = baseLatency ?? pick(`${ep}lat`, 170, 320);
  out.push({ key: 'latencia', status: lat > 800 ? 'falha' : 'ok', ms: lat, detail: `p95 ${lat} ms (limite 800 ms)`, ...(lat > 800 ? { cause: 'Latência acima do limite.', fix: 'Verifique a rota de rede ou use sincronização agendada.' } : {}) });
  return out;
}

// ---------- Impacto da remoção ----------
export interface Impact {
  domains: { id: string; name: string }[];
  contracts: { id: string; name: string }[];
  journeys: { id: string; name: string }[];
  channels: { id: string; name: string }[];
  tables: { id: string; name: string }[];
}

export function computeImpact(ws: WorkspaceData, c: Connector): Impact {
  const ids = new Set<string>(c.consumers);
  // Descendentes na linhagem.
  const start = `ln-${c.id}`;
  const seen = new Set<string>([start]);
  const queue = [start];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const e of ws.lineage.edges) {
      if (e.source === cur && !seen.has(e.target)) {
        seen.add(e.target);
        queue.push(e.target);
      }
    }
  }
  for (const n of ws.lineage.nodes) if (seen.has(n.id) && n.refId) ids.add(n.refId);
  // Canais ligados às jornadas impactadas.
  const journeys = ws.journeys.filter((j) => ids.has(j.id));
  const chIds = new Set(ws.channels.filter((ch) => ids.has(ch.id) || Object.values(ch.journeyByEnv).some((jid) => jid && journeys.some((j) => j.id === jid))).map((ch) => ch.id));
  const domainIds = new Set<string>(c.domainId ? [c.domainId] : []);
  return {
    domains: ws.domains.filter((d) => domainIds.has(d.id)).map((d) => ({ id: d.id, name: d.name })),
    contracts: ws.contracts.filter((k) => ids.has(k.id)).map((k) => ({ id: k.id, name: k.name })),
    journeys: journeys.map((j) => ({ id: j.id, name: j.name })),
    channels: ws.channels.filter((ch) => chIds.has(ch.id)).map((ch) => ({ id: ch.id, name: ch.name })),
    tables: ws.tables.filter((t) => ids.has(t.id)).map((t) => ({ id: t.id, name: t.name })),
  };
}

export function impactCount(i: Impact) {
  return i.domains.length + i.contracts.length + i.journeys.length + i.channels.length + i.tables.length;
}

/** Série de latência das últimas 24 h (barras), determinística. */
export function latencySeries(c: Connector, n = 24): number[] {
  return Array.from({ length: n }, (_, i) => {
    const jitter = (hash(`${c.id}:${i}`) % 40) - 20;
    const spike = c.status === 'degradado' && i > n - 5 ? 1.35 : 1;
    return Math.max(20, Math.round(c.latencyMs * spike * (1 + jitter / 100)));
  });
}

/** Próximo número livre para ids "<p>-cn-<base>-<n>". */
export function nextConnectorId(ws: WorkspaceData, base: string): string {
  let n = 1;
  while (ws.connectors.some((c) => c.id === `${base}-${n}`)) n++;
  return `${base}-${n}`;
}
