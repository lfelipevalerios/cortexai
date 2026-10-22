// Cálculos do módulo Cérebro: cobertura viva do mapa e publicação de regras.
import type { BrainArea, Component, DecisionTable, WorkspaceData } from '@cortex/schemas';
import { DEMO_IDS, getWorkspace, SEED_TODAY } from '@cortex/seed';

const PREFIX: Record<string, string> = { saude: 'sau', varejo: 'var', financeiro: 'fin', telecom: 'tel' };

export function prefixOf(ws: WorkspaceData): string {
  return PREFIX[ws.workspace.industry] ?? ws.workspace.industry.slice(0, 3);
}

export function showcaseTableId(ws: WorkspaceData): string {
  return DEMO_IDS[ws.workspace.industry].showcaseDecisionTableId;
}

/** Id do componente Rule gerado ao publicar a tabela (o showcase segue a convenção da demo). */
export function ruleComponentIdFor(ws: WorkspaceData, table: DecisionTable): string {
  const p = prefixOf(ws);
  if (table.id === showcaseTableId(ws)) return `${p}-cp-rule-showcase`;
  return `${p}-cp-rule-${table.id.replace(`${p}-dt-`, '')}-cerebro`;
}

export function isTablePublishedFromBrain(ws: WorkspaceData, table: DecisionTable): boolean {
  const id = ruleComponentIdFor(ws, table);
  return table.componentId === id && ws.components.some((c) => c.id === id);
}

// ---------- Cobertura viva ----------
const seedCache = new Map<string, WorkspaceData | undefined>();
function seedOf(id: string): WorkspaceData | undefined {
  if (!seedCache.has(id)) seedCache.set(id, getWorkspace(id));
  return seedCache.get(id);
}

export interface AreaStats {
  area: BrainArea;
  coverage: number;
  seedCoverage: number;
  artifacts: number;
  published: number;
  boosts: { pp: number; reason: string }[];
}

const LIVE = new Set(['homologado', 'publicado_prd']);

export function computeAreaStats(ws: WorkspaceData): AreaStats[] {
  const p = prefixOf(ws);
  const seed = seedOf(ws.workspace.id);
  const boosts: Record<string, { pp: number; reason: string }[]> = {};
  const add = (areaId: string, pp: number, reason: string) => {
    if (pp <= 0) return;
    (boosts[areaId] ??= []).push({ pp, reason });
  };

  // Capítulo 2: CRM conectado pelo wizard.
  const crm = ws.connectors.some((c) => c.id === `${p}-cn-crm`);
  if (crm) {
    add('area-dados', 12, 'CRM conectado pelo wizard');
    add('area-arquitetura', 6, 'Novo conector exposto como tool (MCP)');
    add('area-jornadas', 4, 'Clientes do CRM ligados às jornadas');
  }
  if (seed) {
    const seedConn = new Set(seed.connectors.map((c) => c.id));
    const extraConn = ws.connectors.filter((c) => !seedConn.has(c.id) && c.id !== `${p}-cn-crm`).length;
    add('area-dados', extraConn * 4, `${extraConn} conector(es) novo(s)`);
    add('area-arquitetura', extraConn * 2, 'Integrações padronizadas por conector');

    const seedDocs = new Set(seed.documents.map((d) => d.id));
    const newDocs = ws.documents.filter((d) => !seedDocs.has(d.id)).length;
    add('area-mercado', newDocs * 4, `${newDocs} documento(s) novo(s) na base de conhecimento`);
    add('area-empresa', newDocs * 2, 'Conhecimento novo processado');

    const seedVers = seed.contracts.reduce((n, c) => n + c.versions.length, 0);
    const vers = ws.contracts.reduce((n, c) => n + c.versions.length, 0);
    add('area-dados', Math.max(0, vers - seedVers) * 3, 'Contratos de dados com nova versão');

    const seedComp = new Map(seed.components.map((c) => [c.id, c.status]));
    const compUp = ws.components.filter((c) => LIVE.has(c.status) && !LIVE.has(seedComp.get(c.id) ?? 'rascunho')).length;
    add('area-engenharia', compUp * 3, `${compUp} componente(s) homologado(s) no catálogo`);
    const newDrafts = ws.components.filter((c) => !seedComp.has(c.id) && c.status === 'rascunho').length;
    add('area-engenharia', newDrafts * 2, 'Rascunhos sugeridos pela telemetria');

    const seedJv = seed.journeys.reduce((n, j) => n + j.versions.length, 0);
    const jv = ws.journeys.reduce((n, j) => n + j.versions.length, 0);
    add('area-jornadas', Math.max(0, jv - seedJv) * 3, 'Jornadas com nova versão no Studio');

    const newRel = ws.releases.filter((r) => r.status === 'promovida').length - seed.releases.filter((r) => r.status === 'promovida').length;
    add('area-devops', Math.max(0, newRel) * 5, 'Promoções com gates registradas');

    const anchor = ws.journeys.find((j) => j.anchor);
    const seedAnchor = seed.journeys.find((j) => j.anchor);
    const hasPii = (j?: typeof anchor) => !!j?.versions.some((v) => v.graph.nodes.some((n) => n.kind === 'guardrail.pii'));
    if (hasPii(anchor) && !hasPii(seedAnchor)) add('area-seguranca', 6, 'Filtro de PII inserido na jornada-âncora');
    const newPol = ws.policies.length - seed.policies.length;
    add('area-seguranca', Math.max(0, newPol) * 4, 'Políticas novas');

    const ruleBrain = ws.decisionTables.filter((t) => isTablePublishedFromBrain(ws, t)).length;
    add('area-regras', ruleBrain * 10, 'Regra publicada como componente Rule');
  }

  const compById = new Map(ws.components.map((c) => [c.id, c]));
  return ws.brainAreas.map((area) => {
    const arts = ws.artifacts.filter((a) => a.areaId === area.id);
    const pubIds = new Set(arts.map((a) => a.componentId).filter((id): id is string => !!id && LIVE.has(compById.get(id)?.status ?? '')));
    if (area.id === 'area-regras') {
      ws.decisionTables.forEach((t) => {
        if (t.componentId && LIVE.has(compById.get(t.componentId)?.status ?? '')) pubIds.add(t.componentId);
      });
    }
    const b = boosts[area.id] ?? [];
    const coverage = Math.min(100, area.coverage + b.reduce((n, x) => n + x.pp, 0));
    return { area, coverage, seedCoverage: area.coverage, artifacts: arts.length, published: pubIds.size, boosts: b };
  });
}

// ---------- Regra → componente ----------
export function tableAsText(t: DecisionTable): string {
  const head = ['#', ...t.inputs.map((i) => i.key), '→', ...t.outputs.map((o) => o.key)];
  const rows = t.rows.map((r, i) => [String(i + 1), ...t.inputs.map((inp) => r.conditions[inp.key] ?? '*'), '→', ...t.outputs.map((o) => r.outputs[o.key] ?? '')]);
  const widths = head.map((h, c) => Math.min(42, Math.max(h.length, ...rows.map((r) => r[c].length))));
  const line = (cells: string[]) => cells.map((x, c) => x.padEnd(widths[c])).join('  ').trimEnd();
  return [
    `regra: ${t.name}`,
    `versao: ${t.version}`,
    ...(t.source ? [`fonte: ${t.source}`] : []),
    'politica: primeira linha que casa vence',
    `entradas: ${t.inputs.map((i) => i.key).join(', ')}`,
    `saidas: ${t.outputs.map((o) => o.key).join(', ')}`,
    '',
    line(head),
    ...rows.map(line),
  ].join('\n');
}

/** Journeys que usam a tabela (nó com ruleId) em alguma versão. */
export function journeysUsingTable(ws: WorkspaceData, tableId: string) {
  return ws.journeys.filter((j) => j.versions.some((v) => v.graph.nodes.some((n) => n.ruleId === tableId)));
}

export function buildRuleComponent(ws: WorkspaceData, t: DecisionTable, at: string): Component {
  const name = (p: string) => ws.users.find((u) => u.profile === p)?.name ?? p;
  const consumers = journeysUsingTable(ws, t.id).length;
  const cases = Math.max(6, t.rows.length * 2);
  return {
    id: ruleComponentIdFor(ws, t),
    type: 'rule',
    name: t.name,
    version: t.version,
    status: 'homologado',
    domainId: t.domainId,
    owner: name('dono_negocio'),
    consumers,
    rating: 0,
    description: `${t.description} Publicada a partir da tabela de decisão do cérebro.`,
    content: tableAsText(t),
    inputs: t.inputs.map((i) => i.key),
    outputs: t.outputs.map((o) => o.key),
    dependencies: [],
    changelog: [{ version: t.version, date: SEED_TODAY, note: 'Publicada a partir da tabela de decisão do cérebro.' }],
    evaluation: { score: 100, cases, passed: cases },
    approvals: [
      { at, by: name('coe'), profile: 'coe', decision: 'aprovado', note: `Checagens automáticas ok; ${cases} casos de teste cobrem todas as ${t.rows.length} linhas.` },
    ],
  };
}

export function bumpMinor(v: string): string {
  const [a, b] = v.split('.').map((x) => Number(x) || 0);
  return `${a}.${(b ?? 0) + 1}.0`;
}
