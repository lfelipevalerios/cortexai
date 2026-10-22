'use client';

// Pontos de restauração da jornada guiada (chapter-0 … chapter-8).
// Cada ponto parte de uma cópia nova do seed e aplica, em ordem, os marcos
// dos capítulos anteriores conforme a tabela "Estado por capítulo" de
// docs/CONVENCOES_DA_DEMO.md. A progressão sequencial do roteiro não usa
// este módulo (o estado é o que o apresentador fez na tela); ele só entra
// quando o apresentador salta para um capítulo ou pede para restaurá-lo.

import type { Component, Connector, IndustryId, ProfileId, WorkspaceData } from '@cortex/schemas';
import { CRM_WIZARD_PRESET, DEMO_IDS, SEED_TODAY, generateWorkspaces } from '@cortex/seed';
import { SAMPLE_OPENAPI_SPEC, parseOpenApi, validateGraph } from '@cortex/engine';
import { useCortex } from '@/lib/store';

export const ID_PREFIX: Record<IndustryId, string> = { saude: 'sau', varejo: 'var', financeiro: 'fin', telecom: 'tel' };

/** Indústria usada quando ainda não há workspace ativo (mesma escolha do piloto do seletor). */
export const DEFAULT_INDUSTRY: IndustryId = 'telecom';

/** Marcos persistidos, na ordem em que o roteiro completo os produz. */
export const MILESTONES_BY_CHAPTER: Record<number, string[]> = {
  0: [],
  1: [],
  2: ['CRM conectado pelo wizard', 'OpenAPI importada como conector'],
  3: [], // bloqueio do contrato não persiste
  4: ['Regra publicada como componente'],
  5: ['Iniciativa-âncora em construção', 'Filtro de PII em nova versão (Dev)', 'Promoção Dev → Hml'],
  6: ['WhatsApp plugado (Dev e Hml)', 'Ordem de construção concluída'],
  7: ['Aprovações de Prd (dono e CoE)', 'Promoção Hml → Prd', 'Sugestão aceita'],
  8: [],
};

/** Descrição curta do estado de entrada de um capítulo (para a interface). */
export function restoreSummary(chapter: number): string {
  const done = Object.entries(MILESTONES_BY_CHAPTER)
    .filter(([c]) => Number(c) < chapter)
    .flatMap(([, m]) => m);
  if (chapter === 1) return 'Workspace do seed com o Cockpit em "antes do Córtex".';
  return done.length ? `Workspace do seed com: ${done.join('; ')}.` : 'Workspace do seed, sem alterações.';
}

const at = (h: number, m = 0) => `${SEED_TODAY}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00-03:00`;

function userName(ws: WorkspaceData, profile: ProfileId): string {
  return ws.users.find((u) => u.profile === profile)?.name ?? 'Usuário da demo';
}

function bumpMinor(v: string): string {
  const [maj, min] = v.split('.').map((x) => Number.parseInt(x, 10) || 0);
  return `${maj}.${min + 1}.0`;
}

// ---------- Marcos ----------

function connectCrm(ws: WorkspaceData, industry: IndustryId) {
  const p = ID_PREFIX[industry];
  const preset = CRM_WIZARD_PRESET[industry];
  const id = `${p}-cn-crm`;
  if (!ws.connectors.some((c) => c.id === id)) {
    const crm: Connector = {
      id,
      typeId: preset.typeId,
      name: preset.name,
      status: 'conectado',
      envs: { dev: { endpoint: preset.endpoint, secretRef: `cofre://${p}/crm/dev` } },
      domainId: preset.domainId,
      syncMode: 'cdc',
      lastSync: at(9, 14),
      volume: preset.objects.reduce((a, o) => a + o.records, 0),
      latencyMs: 182,
      consumers: [],
      objects: structuredClone(preset.objects),
      tools: structuredClone(preset.tools),
      logs: [
        { at: at(9, 12), level: 'info', message: 'Teste de conexão: rede, autenticação, permissão e latência ok' },
        { at: at(9, 13), level: 'info', message: `Descoberta concluída: ${preset.objects.length} objetos, PII mascarada` },
        { at: at(9, 14), level: 'info', message: 'Conector cadastrado em Dev pelo wizard' },
      ],
    };
    ws.connectors.unshift(crm);
  }
  const sys = ws.systems.find((s) => s.id === DEMO_IDS[industry].crmSystemId);
  if (sys) sys.connectorId = id;
  const mcp = ws.components.find((c) => c.id === `${p}-cp-mcp-crm`);
  if (mcp) {
    mcp.status = 'em_revisao';
    mcp.content = JSON.stringify({ server: 'mcp-crm', conector: id, tools: preset.tools.map((t) => t.name) }, null, 2);
  }
}

function importOpenApi(ws: WorkspaceData, industry: IndustryId) {
  const p = ID_PREFIX[industry];
  const id = `${p}-cn-openapi`;
  if (ws.connectors.some((c) => c.id === id)) return;
  const spec = parseOpenApi(SAMPLE_OPENAPI_SPEC);
  ws.connectors.unshift({
    id,
    typeId: 'rest-openapi',
    name: spec.title,
    status: 'conectado',
    envs: { dev: { endpoint: spec.baseUrl ?? '', secretRef: `cofre://${p}/openapi/dev` } },
    syncMode: 'sob_demanda',
    lastSync: at(9, 18),
    volume: 0,
    latencyMs: 240,
    consumers: [],
    objects: spec.objects,
    tools: spec.tools.map((t) => ({ ...t, id: `${p}-tl-oa-${t.id}` })),
    logs: [{ at: at(9, 18), level: 'info', message: `Especificação ${spec.title} ${spec.version} importada: ${spec.tools.length} tools geradas` }],
  });
}

function publishShowcaseRule(ws: WorkspaceData, industry: IndustryId) {
  const p = ID_PREFIX[industry];
  const dt = ws.decisionTables.find((d) => d.id === DEMO_IDS[industry].showcaseDecisionTableId);
  if (!dt) return;
  const cid = `${p}-cp-rule-showcase`;
  if (!ws.components.some((c) => c.id === cid)) {
    const comp: Component = {
      id: cid,
      type: 'rule',
      name: dt.name,
      version: dt.version,
      status: 'homologado',
      domainId: dt.domainId,
      owner: userName(ws, 'dono_negocio'),
      consumers: 0,
      rating: 0,
      description: dt.description,
      content: dt.rows
        .map((r, i) => {
          const cond = Object.entries(r.conditions).map(([k, v]) => `${k} ${v}`).join(' E ');
          const out = Object.entries(r.outputs).map(([k, v]) => `${k} = ${v}`).join(', ');
          return `Linha ${i + 1}: SE ${cond} ENTAO ${out}`;
        })
        .join('\n'),
      inputs: dt.inputs.map((i) => i.label),
      outputs: dt.outputs.map((o) => o.label),
      dependencies: [],
      changelog: [{ version: dt.version, date: SEED_TODAY, note: 'Publicada como componente a partir da tabela de decisão.' }],
      evaluation: { score: 100, cases: dt.rows.length, passed: dt.rows.length },
      approvals: [
        { at: at(10, 2), by: userName(ws, 'coe'), profile: 'coe', decision: 'aprovado', note: 'Casos de teste cobrem todas as linhas da tabela.' },
      ],
    };
    ws.components.unshift(comp);
  }
  dt.componentId = cid;
}

/** Iniciativa validada, Seguir, Gerar jornada → construção; PII corrigida em nova versão; Dev → Hml. */
function createAndPromoteHml(ws: WorkspaceData, industry: IndustryId): string | null {
  const demo = DEMO_IDS[industry];
  const ini = ws.initiatives.find((i) => i.id === demo.anchorInitiativeId);
  if (ini) {
    ini.stage = 'construcao';
    ini.journeyId = demo.anchorJourneyId;
    if (ini.validation) ini.validation.decision = 'seguir';
  }
  const j = ws.journeys.find((x) => x.id === demo.anchorJourneyId);
  if (!j || !j.versions.length) return null;
  const cur = j.versions[j.versions.length - 1];
  let graph = structuredClone(cur.graph);
  for (let i = 0; i < 6; i++) {
    const pr = validateGraph(graph, { data: ws, env: 'dev', risk: j.risk }).find((x) => x.code === 'pii_sem_filtro' && x.fix);
    if (!pr?.fix) break;
    graph = pr.fix.apply(graph);
  }
  const version = bumpMinor(cur.version);
  j.versions.push({
    version,
    createdAt: at(10, 30),
    author: userName(ws, 'champion'),
    note: 'Filtro de PII inserido pela correção da validação; teste com persona passando.',
    graph,
  });
  j.envVersions.dev = version;
  j.envVersions.hml = version;
  ws.releases.unshift({
    id: `${ID_PREFIX[industry]}-rel-tour-hml`,
    journeyId: j.id,
    from: 'dev',
    to: 'hml',
    version,
    at: at(10, 40),
    by: userName(ws, 'champion'),
    status: 'promovida',
  });
  return version;
}

function deliver(ws: WorkspaceData, industry: IndustryId, version: string | null) {
  const demo = DEMO_IDS[industry];
  const ch = ws.channels.find((c) => c.id === demo.whatsappChannelId);
  if (ch) {
    ch.journeyByEnv = { ...ch.journeyByEnv, dev: demo.anchorJourneyId, hml: demo.anchorJourneyId };
    ch.status = 'ativo';
  }
  // Ordem de construção concluída do seed, alinhada à versão corrigida.
  const j = ws.journeys.find((x) => x.id === demo.anchorJourneyId);
  const oc = ws.buildOrders.find((o) => o.journeyId === demo.anchorJourneyId);
  if (oc && j && version) {
    const v = j.versions.find((x) => x.version === version);
    oc.journeyVersion = version;
    if (v) oc.progress = Object.fromEntries(v.graph.nodes.map((n) => [n.id, 'construido' as const]));
  }
}

function governAndPromotePrd(ws: WorkspaceData, industry: IndustryId, version: string | null) {
  const p = ID_PREFIX[industry];
  const demo = DEMO_IDS[industry];
  const j = ws.journeys.find((x) => x.id === demo.anchorJourneyId);
  if (j && version) {
    const objectId = `${j.id}@${version}->prd`;
    const title = `Promover "${j.name}" ${version} para Prd`;
    const requestedBy = userName(ws, 'champion');
    ws.approvals.unshift(
      {
        id: `${p}-ap-tour-dono`, kind: 'promocao', title, requestedBy, requestedAt: at(11, 0), status: 'aprovado',
        approverProfile: 'dono_negocio', objectId,
        comments: [{ by: userName(ws, 'dono_negocio'), at: at(11, 12), text: 'Aprovado: jornada validada em Hml com o filtro de PII.' }],
      },
      {
        id: `${p}-ap-tour-coe`, kind: 'promocao', title, requestedBy, requestedAt: at(11, 0), status: 'aprovado',
        approverProfile: 'coe', objectId,
        comments: [{ by: userName(ws, 'coe'), at: at(11, 4), text: 'Gates técnicos ok do lado do CoE.' }],
      },
    );
    ws.releases.unshift(
      { id: `${p}-rel-tour-prd`, journeyId: j.id, from: 'hml', to: 'prd', version, at: at(11, 15), by: userName(ws, 'coe'), status: 'promovida', trafficPct: 100 },
      { id: `${p}-rel-tour-prd-bloq`, journeyId: j.id, from: 'hml', to: 'prd', version, at: at(11, 1), by: requestedBy, status: 'bloqueada' },
    );
    j.envVersions.prd = version;
  }
  // Sugestão aceita vira rascunho no Catálogo.
  const sug = ws.suggestions.find((s) => s.status === 'nova');
  if (sug) {
    sug.status = 'aceita';
    ws.components.unshift({
      id: `${p}-cp-sugestao-aceita`,
      type: sug.kind === 'regra' ? 'rule' : 'skill',
      name: sug.title,
      version: '0.1.0',
      status: 'rascunho',
      owner: userName(ws, 'champion'),
      consumers: 0,
      rating: 0,
      description: sug.proposal,
      content: sug.proposal,
      inputs: [],
      outputs: [],
      dependencies: [],
      changelog: [{ version: '0.1.0', date: SEED_TODAY, note: 'Rascunho criado a partir de sugestão do cérebro.' }],
      evaluation: { score: 0, cases: 0, passed: 0 },
      approvals: [],
    });
  }
}

/** Workspace de entrada do capítulo `chapter` para a indústria dada (puro, sem tocar no store). */
export function buildRestoreWorkspace(chapter: number, industry: IndustryId): WorkspaceData {
  const fresh = generateWorkspaces().find((w) => w.workspace.industry === industry);
  if (!fresh) throw new Error(`Workspace da indústria ${industry} não encontrado`);
  const ws = structuredClone(fresh);
  if (chapter > 2) {
    connectCrm(ws, industry);
    importOpenApi(ws, industry);
  }
  if (chapter > 4) publishShowcaseRule(ws, industry);
  let version: string | null = null;
  if (chapter > 5) version = createAndPromoteHml(ws, industry);
  if (chapter > 6) deliver(ws, industry, version);
  if (chapter > 7) governAndPromotePrd(ws, industry, version);
  return ws;
}

export function currentIndustry(): IndustryId {
  const s = useCortex.getState();
  const id = s.activeWorkspaceId;
  return (id && s.workspaces[id]?.workspace.industry) || DEFAULT_INDUSTRY;
}

/** Flags de capítulo: só o Cockpit "antes do Córtex" (capítulo 1). */
export function applyChapterFlags(chapter: number) {
  useCortex.getState().setFlag('cockpit-antes', chapter === 1);
}

/**
 * Aplica o ponto de restauração `chapter-<n>` ao workspace da indústria
 * (por padrão, a do workspace ativo). Também volta o perfil para Champion,
 * o ambiente para Dev e zera as flags do workspace.
 */
export function applyRestorePoint(chapter: number, industry: IndustryId = currentIndustry()): WorkspaceData {
  const ws = buildRestoreWorkspace(chapter, industry);
  const s = useCortex.getState();
  s.replaceWorkspace(ws);
  if (chapter >= 1 || !s.activeWorkspaceId) s.setWorkspace(ws.workspace.id);
  useCortex.setState((st) => ({ flags: { ...st.flags, [ws.workspace.id]: { 'cockpit-antes': chapter === 1 } } }));
  s.setEnv('dev');
  s.setProfile('champion');
  return ws;
}

/** Converte o id do ponto ("chapter-3") em número do capítulo. */
export function restoreChapterOf(restoreState?: string): number | null {
  const m = restoreState?.match(/^chapter-(\d+)$/);
  return m ? Number(m[1]) : null;
}
