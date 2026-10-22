// Verificação do seed: integridade referencial, determinismo, tamanho e padrões da demo.
// Uso (na raiz do monorepo): npx -y tsx packages/seed/scripts/check.ts
import { NODE_KINDS, type DecisionRow, type DecisionTable, type WorkspaceData } from '@cortex/schemas';
import {
  BREAKING_FIELD, CONNECTOR_TYPES, CRM_WIZARD_PRESET, DEMO_IDS, SEED_TODAY, generateWorkspaces, getWorkspace,
} from '../src/index';

const errors: string[] = [];
const fail = (ws: string, msg: string) => errors.push(`[${ws}] ${msg}`);

function cellMatches(cond: string, value: string | number | boolean): boolean {
  const c = cond.trim();
  if (c === '*' || c === '') return true;
  const v = String(value);
  const n = Number(value);
  if (c.startsWith('!=')) return v !== c.slice(2);
  if (c.startsWith('>=')) return n >= Number(c.slice(2));
  if (c.startsWith('<=')) return n <= Number(c.slice(2));
  if (c.startsWith('>')) return n > Number(c.slice(1));
  if (c.startsWith('<')) return n < Number(c.slice(1));
  if (c.startsWith('=')) return v === c.slice(1);
  if (/^-?[\d.]+\.\.-?[\d.]+$/.test(c)) {
    const [a, b] = c.split('..').map(Number);
    return n >= a && n <= b;
  }
  if (c.includes('|')) return c.split('|').includes(v);
  return v === c;
}

export function matchingRows(t: DecisionTable): DecisionRow[] {
  return t.rows.filter((r) => Object.entries(r.conditions).every(([k, cond]) => cellMatches(cond, t.sampleCase[k] ?? '')));
}

export function validateWorkspace(ws: WorkspaceData): void {
  const W = ws.workspace.id;
  const ids = <T extends { id: string }>(xs: T[]) => new Set(xs.map((x) => x.id));
  const uniq = (label: string, xs: { id: string }[]) => {
    const s = new Set<string>();
    for (const x of xs) { if (s.has(x.id)) fail(W, `${label}: id duplicado ${x.id}`); s.add(x.id); }
  };
  const need = (label: string, set: Set<string>, id: string | undefined) => {
    if (id !== undefined && !set.has(id)) fail(W, `${label}: referência inexistente "${id}"`);
  };

  uniq('users', ws.users); uniq('systems', ws.systems); uniq('connectors', ws.connectors); uniq('channels', ws.channels);
  uniq('domains', ws.domains); uniq('contracts', ws.contracts); uniq('tables', ws.tables); uniq('collections', ws.collections);
  uniq('documents', ws.documents); uniq('components', ws.components); uniq('journeys', ws.journeys); uniq('initiatives', ws.initiatives);
  uniq('policies', ws.policies); uniq('decisionTables', ws.decisionTables); uniq('artifacts', ws.artifacts); uniq('executions', ws.executions);
  uniq('audit', ws.audit); uniq('approvals', ws.approvals); uniq('releases', ws.releases); uniq('metrics', ws.metrics);

  const users = ids(ws.users), userNames = new Set(ws.users.map((u) => u.name));
  const connectors = ids(ws.connectors), channels = ids(ws.channels), domains = ids(ws.domains);
  const contracts = ids(ws.contracts), tables = ids(ws.tables), docs = ids(ws.documents), cols = ids(ws.collections);
  const comps = ids(ws.components), journeys = ids(ws.journeys), inits = ids(ws.initiatives), policies = ids(ws.policies);
  const dts = ids(ws.decisionTables), areas = ids(ws.brainAreas);
  const types = new Set(CONNECTOR_TYPES.map((t) => t.id));
  const tools = new Set(ws.connectors.flatMap((c) => c.tools.map((t) => t.id)));
  const owner = (label: string, name: string) => { if (!userNames.has(name)) fail(W, `${label}: dono "${name}" não é usuário`); };

  // Organização
  if (ws.users.length !== 8 || new Set(ws.users.map((u) => u.profile)).size !== 8) fail(W, 'users: esperado um por perfil');
  ws.users.forEach((u) => u.domainIds.forEach((d) => need(`user ${u.id}`, domains, d)));

  // Conectar
  ws.systems.forEach((s) => need(`system ${s.id}`, connectors, s.connectorId));
  const crm = ws.systems.find((s) => s.id === DEMO_IDS[ws.workspace.industry].crmSystemId);
  if (!crm || crm.connectorId || crm.category !== 'crm') fail(W, 'CRM deve existir em systems, sem connectorId');
  if (ws.connectors.some((c) => c.typeId === CRM_WIZARD_PRESET[ws.workspace.industry].typeId)) fail(W, 'CRM não pode estar em connectors');
  if (ws.connectors.length < 4 || ws.connectors.length > 6) fail(W, `connectors: ${ws.connectors.length} (esperado 4–6)`);
  if (ws.connectors.filter((c) => c.status === 'degradado').length !== 1) fail(W, 'connectors: esperado exatamente um degradado');
  const consumerIds = new Set([...journeys, ...contracts, ...channels]);
  for (const c of ws.connectors) {
    need(`connector ${c.id} typeId`, types, c.typeId);
    need(`connector ${c.id} domain`, domains, c.domainId);
    c.consumers.forEach((x) => need(`connector ${c.id} consumer`, consumerIds, x));
    if (c.objects.length < 2 || c.objects.length > 4) fail(W, `connector ${c.id}: ${c.objects.length} objetos`);
    for (const o of c.objects) {
      if (o.sample.length > 10) fail(W, `connector ${c.id}/${o.name}: amostra > 10`);
      for (const f of o.fields.filter((x) => x.pii && /cpf/i.test(x.name))) {
        o.sample.forEach((r) => { if (typeof r[f.name] === 'string' && !String(r[f.name]).includes('*')) fail(W, `CPF sem máscara em ${c.id}/${o.name}`); });
      }
    }
    for (const t of c.tools) {
      if (t.mode === 'escrita' && t.enabledByEnv.prd) fail(W, `tool de escrita ligada em Prd: ${t.id}`);
      need(`tool ${t.id} policy`, policies, t.policyId);
    }
    for (const [env, cred] of Object.entries(c.envs)) {
      if (cred && cred.secretRef !== `kv://cortex/${W}/${c.id}/${env}`) fail(W, `secretRef inesperado em ${c.id}`);
    }
  }
  const wa = ws.channels.find((c) => c.id === DEMO_IDS[ws.workspace.industry].whatsappChannelId);
  if (!wa || wa.type !== 'whatsapp' || Object.keys(wa.journeyByEnv).length) fail(W, 'WhatsApp deve existir sem jornada vinculada');
  ws.channels.forEach((c) => Object.values(c.journeyByEnv).forEach((j) => need(`channel ${c.id}`, journeys, j)));
  ws.ideConnections.forEach((i) => need(`ide ${i.id}`, users, i.userId));

  // Dados e conhecimento
  const negocio = ws.domains.filter((d) => d.kind === 'negocio').length;
  if (negocio !== 6) fail(W, `domains negócio: ${negocio}`);
  for (const d of ws.domains) {
    d.relations.forEach((r) => need(`domain ${d.id} relation`, domains, r));
    d.products.forEach((p) => need(`domain ${d.id} product`, tables, p));
    d.consumers.forEach((j) => need(`domain ${d.id} consumer`, journeys, j));
    owner(`domain ${d.id}`, d.owner);
    if (d.position.x < 0 || d.position.x > 900 || d.position.y < 0 || d.position.y > 500) fail(W, `domain ${d.id}: posição fora da grade`);
  }
  if (ws.contracts.length < 5) fail(W, 'contracts < 5');
  for (const c of ws.contracts) {
    need(`contract ${c.id}`, domains, c.domainId);
    owner(`contract ${c.id}`, c.owner);
    if (c.versions.length !== 2) fail(W, `contract ${c.id}: esperado 2 versões`);
    c.versions.forEach((v) => v.quality.forEach((q) => { if (q.history.length !== 10) fail(W, `quality ${q.id}: histórico != 10`); }));
  }
  for (const layer of ['bronze', 'prata', 'ouro'] as const) {
    if (ws.tables.filter((t) => t.layer === layer).length < 3) fail(W, `tables ${layer} < 3`);
  }
  ws.tables.forEach((t) => { need(`table ${t.id}`, domains, t.domainId); if (t.sample.length > 10) fail(W, `table ${t.id}: amostra > 10`); });
  if (ws.sqlExamples.length !== 3) fail(W, 'sqlExamples != 3');
  const refKinds: Record<string, Set<string>> = { conector: connectors, bronze: tables, prata: tables, ouro: tables, contrato: contracts, jornada: journeys, canal: channels };
  const lnIds = new Set(ws.lineage.nodes.map((n) => n.id));
  ws.lineage.nodes.forEach((n) => need(`lineage ${n.id}`, refKinds[n.kind], n.refId));
  ws.lineage.edges.forEach((e) => { need('lineage edge', lnIds, e.source); need('lineage edge', lnIds, e.target); });
  if (ws.lineage.nodes.length < 10 || ws.lineage.nodes.length > 14) fail(W, `lineage: ${ws.lineage.nodes.length} nós`);
  ws.collections.forEach((c) => { need(`collection ${c.id}`, domains, c.domainId); owner(`collection ${c.id}`, c.owner); });
  ws.documents.forEach((d) => {
    need(`document ${d.id}`, cols, d.collectionId);
    if (d.chunks.length < 3 || d.chunks.length > 6) fail(W, `document ${d.id}: ${d.chunks.length} trechos`);
  });
  if (ws.retrievals.length !== 3) fail(W, 'retrievals != 3');
  for (const r of ws.retrievals) {
    for (const x of r.results) {
      const d = ws.documents.find((doc) => doc.id === x.docId);
      if (!d) fail(W, `retrieval: doc inexistente ${x.docId}`);
      else if (x.chunkIndex >= d.chunks.length) fail(W, `retrieval: trecho ${x.chunkIndex} inexistente em ${x.docId}`);
    }
  }
  const sq = DEMO_IDS[ws.workspace.industry].showcaseQuestion;
  if (!ws.retrievals.some((r) => r.question === sq)) fail(W, 'pergunta de destaque sem retrieval');
  if (ws.workspace.industry === 'varejo') {
    const r = ws.retrievals.find((x) => x.question === 'qual o prazo para troca de produto com defeito?');
    const doc = r && ws.documents.find((d) => d.id === r.results[0]?.docId);
    if (!doc || doc.title !== 'Política de trocas v3') fail(W, 'varejo: pergunta da troca deve vir da "Política de trocas v3"');
  }
  const kgIds = new Set(ws.knowledgeGraph.nodes.map((n) => n.id));
  for (const n of ws.knowledgeGraph.nodes) {
    if (n.kind === 'tabela') need(`kg ${n.id}`, tables, n.id);
    if (n.kind === 'documento') need(`kg ${n.id}`, docs, n.id);
    if (n.kind === 'regra') need(`kg ${n.id}`, dts, n.id);
  }
  ws.knowledgeGraph.edges.forEach((e) => { need('kg edge', kgIds, e.source); need('kg edge', kgIds, e.target); });

  // Cérebro e catálogo
  if (ws.brainAreas.length !== 10) fail(W, 'brainAreas != 10');
  ws.brainAreas.forEach((a) => owner(`area ${a.id}`, a.owner));
  for (const a of ws.brainAreas) {
    const n = ws.artifacts.filter((x) => x.areaId === a.id).length;
    if (n < 3 || n > 5) fail(W, `area ${a.id}: ${n} artefatos`);
  }
  ws.artifacts.forEach((a) => { need(`artifact ${a.id}`, areas, a.areaId); need(`artifact ${a.id}`, comps, a.componentId); });
  const showcase = ws.decisionTables.find((t) => t.id === DEMO_IDS[ws.workspace.industry].showcaseDecisionTableId);
  if (!showcase) fail(W, 'tabela de decisão de destaque inexistente');
  for (const t of ws.decisionTables) {
    need(`decisionTable ${t.id}`, domains, t.domainId);
    need(`decisionTable ${t.id}`, comps, t.componentId);
    const keys = new Set(t.inputs.map((i) => i.key));
    t.rows.forEach((r) => Object.keys(r.conditions).forEach((k) => { if (!keys.has(k)) fail(W, `decisionTable ${t.id}: condição em entrada inexistente ${k}`); }));
    const m = matchingRows(t);
    if (m.length !== 1) fail(W, `decisionTable ${t.id}: sampleCase casa ${m.length} linhas (${m.map((x) => x.id).join(',')})`);
  }
  const ctypes = new Set(ws.components.map((c) => c.type));
  if (ctypes.size !== 7) fail(W, `components: ${ctypes.size} tipos`);
  const cstat = new Set(ws.components.map((c) => c.status));
  if (cstat.size !== 5) fail(W, `components: ${cstat.size} status`);
  ws.components.forEach((c) => { c.dependencies.forEach((d) => need(`component ${c.id} dep`, comps, d)); need(`component ${c.id}`, domains, c.domainId); owner(`component ${c.id}`, c.owner); });

  // Jornadas
  if (ws.journeys.length !== 3) fail(W, 'journeys != 3');
  const kinds = new Map(NODE_KINDS.map((k) => [k.kind, k]));
  const compVersion = new Map(ws.components.map((c) => [c.id, c.version]));
  ws.journeys.forEach((j, idx) => {
    need(`journey ${j.id}`, domains, j.domainId);
    need(`journey ${j.id}`, inits, j.initiativeId);
    const versions = new Set(j.versions.map((v) => v.version));
    Object.entries(j.envVersions).forEach(([env, v]) => { if (v && !versions.has(v)) fail(W, `journey ${j.id}: ${env} aponta versão inexistente ${v}`); });
    for (const v of j.versions) {
      const nodeIds = new Set(v.graph.nodes.map((n) => n.id));
      if (v.graph.nodes.length < 5 || v.graph.nodes.length > 10) fail(W, `journey ${j.id}@${v.version}: ${v.graph.nodes.length} nós`);
      for (const n of v.graph.nodes) {
        const def = kinds.get(n.kind);
        if (!def || def.category !== n.category) fail(W, `journey ${j.id}: kind inválido ${n.kind}`);
        need(`node ${j.id}/${n.id} component`, comps, n.componentId);
        if (n.componentId && compVersion.get(n.componentId) !== n.componentVersion) fail(W, `node ${j.id}/${n.id}: versão de componente divergente`);
        need(`node ${j.id}/${n.id} rule`, dts, n.ruleId);
        need(`node ${j.id}/${n.id} contract`, contracts, n.contractId);
        need(`node ${j.id}/${n.id} tool`, tools, n.toolId);
        need(`node ${j.id}/${n.id} channel`, channels, n.channelId);
      }
      for (const e of v.graph.edges) {
        need(`edge ${j.id}/${e.id}`, nodeIds, e.source); need(`edge ${j.id}/${e.id}`, nodeIds, e.target);
        const src = v.graph.nodes.find((n) => n.id === e.source);
        if (src?.outputs && (!e.sourceHandle || !src.outputs.includes(e.sourceHandle))) fail(W, `edge ${j.id}/${e.id}: sourceHandle inválido`);
      }
      // Nenhuma jornada além da âncora pode enviar PII direto ao canal.
      const latest = v === j.versions[j.versions.length - 1];
      const direct = v.graph.edges.filter((e) => {
        const s = v.graph.nodes.find((n) => n.id === e.source);
        const t = v.graph.nodes.find((n) => n.id === e.target);
        return s?.emitsPii && t?.kind === 'saida.responder';
      });
      if (j.anchor) {
        if (!latest) continue;
        const waEdge = direct.find((e) => v.graph.nodes.find((n) => n.id === e.target)?.channelId === wa?.id);
        if (!waEdge) fail(W, `âncora ${j.id}: falta o padrão PII → Responder (WhatsApp) sem filtro`);
        if (v.graph.nodes.some((n) => n.kind === 'guardrail.pii')) fail(W, `âncora ${j.id}: versão Dev não pode ter filtro de PII`);
      } else if (direct.length) fail(W, `journey ${j.id}@${v.version}: PII direto ao canal`);
    }
    const last = j.versions[j.versions.length - 1];
    for (const n of last.graph.nodes) {
      const s = j.script[n.id];
      if (!s) { fail(W, `journey ${j.id}: sem script para ${n.id}`); continue; }
      const agent = n.category === 'agente';
      if (!agent && s.tokens !== 0) fail(W, `script ${j.id}/${n.id}: tokens em nó não agente`);
      if (s.latencyMs < 5 || s.latencyMs > 1800) fail(W, `script ${j.id}/${n.id}: latência ${s.latencyMs}`);
      if (n.outputs && (!s.takeHandle || !n.outputs.includes(s.takeHandle))) fail(W, `script ${j.id}/${n.id}: takeHandle inválido`);
    }
    if (j.anchor && !j.script.__pii_filter__) fail(W, `âncora ${j.id}: falta script __pii_filter__`);
    if (idx === 0) {
      if (!j.anchor || j.id !== DEMO_IDS[ws.workspace.industry].anchorJourneyId) fail(W, 'primeira jornada deve ser a âncora');
      if (j.envVersions.dev !== last.version || j.envVersions.hml !== null || j.envVersions.prd !== null) fail(W, 'âncora: envVersions deve ser só Dev');
    }
    if (idx === 1) {
      if (j.id !== DEMO_IDS[ws.workspace.industry].prdJourneyId || !j.envVersions.prd || !j.envVersions.hml) fail(W, 'segunda jornada deve estar em Prd');
    }
    if (idx === 2) {
      if (j.type !== 'automacao' || !j.envVersions.hml || j.envVersions.prd) fail(W, 'terceira jornada: automação em Dev e Hml');
      if (last.graph.nodes.some((n) => n.category === 'agente')) fail(W, 'automação não pode ter nó de agente');
    }
    if (j.testCases.length < 2 || j.testCases.length > 3) fail(W, `journey ${j.id}: ${j.testCases.length} casos de teste`);
  });
  // Campo que quebra contrato usado em Prd
  const bf = BREAKING_FIELD[ws.workspace.industry];
  const bc = ws.contracts.find((c) => c.id === bf.contractId);
  if (!bc || !bc.versions[bc.versions.length - 1].fields.some((f) => f.name === bf.field)) fail(W, 'BREAKING_FIELD: campo inexistente na versão atual');
  const prdJ = ws.journeys.find((j) => j.id === DEMO_IDS[ws.workspace.industry].prdJourneyId);
  const prdV = prdJ?.versions.find((v) => v.version === prdJ.envVersions.prd);
  if (!prdV?.graph.nodes.some((n) => n.contractId === bf.contractId)) fail(W, 'BREAKING_FIELD: contrato não usado pela versão em Prd');

  ws.releases.forEach((r) => {
    need(`release ${r.id}`, journeys, r.journeyId);
    const j = ws.journeys.find((x) => x.id === r.journeyId);
    if (j && !j.versions.some((v) => v.version === r.version)) fail(W, `release ${r.id}: versão inexistente`);
  });
  if (ws.initiatives.length < 8 || ws.initiatives.length > 10) fail(W, 'initiatives fora de 8–10');
  if (new Set(ws.initiatives.map((i) => i.stage)).size !== 5) fail(W, 'initiatives: faltam estágios');
  ws.initiatives.forEach((i) => { need(`initiative ${i.id}`, domains, i.domainId); need(`initiative ${i.id}`, journeys, i.journeyId); owner(`initiative ${i.id}`, i.owner); });
  const ai = ws.initiatives.find((i) => i.id === DEMO_IDS[ws.workspace.industry].anchorInitiativeId);
  if (!ai || ai.stage !== 'ideia' || ai.journeyId !== DEMO_IDS[ws.workspace.industry].anchorJourneyId) fail(W, 'iniciativa âncora inválida');
  else {
    const v = ai.validation;
    if (!v || v.checks.length !== 8 || v.decision || v.reusePct !== 70) fail(W, 'validação da âncora inválida');
    else {
      if (new Set(v.checks.map((c) => c.key)).size !== 8) fail(W, 'validação: chaves repetidas');
      if (!v.checks.some((c) => c.result === 'amarelo' && /lacuna de dado/i.test(c.summary))) fail(W, 'validação: falta amarelo "lacuna de dado"');
      if (!/o cérebro indica/i.test(v.recommendation)) fail(W, 'validação: recomendação não consultiva');
    }
  }
  for (const b of ws.buildOrders) {
    need(`buildOrder ${b.id}`, journeys, b.journeyId);
    const j = ws.journeys.find((x) => x.id === b.journeyId);
    const v = j?.versions.find((x) => x.version === b.journeyVersion);
    if (!v) fail(W, `buildOrder ${b.id}: versão inexistente`);
    else if (v.graph.nodes.some((n) => b.progress[n.id] !== 'construido')) fail(W, `buildOrder ${b.id}: nós não construídos`);
  }
  if (ws.buildOrders.length !== 1 || ws.buildOrders[0].status !== 'concluida' || !ws.buildOrders[0].prUrl) fail(W, 'buildOrders: esperada 1 OC concluída com PR');

  // Governar e medir
  if (ws.policies.length < 5 || ws.policies.length > 7) fail(W, `policies: ${ws.policies.length}`);
  ws.policies.forEach((p) => { try { JSON.parse(p.code); } catch { fail(W, `policy ${p.id}: code não é JSON`); } });
  const allIds = new Set<string>([
    ...journeys, ...comps, ...contracts, ...users, ...connectors, ...channels, ...dts, ...inits, ...policies,
  ]);
  ws.approvals.forEach((a) => need(`approval ${a.id}`, allIds, a.objectId));
  if (ws.approvals.length < 4 || ws.approvals.length > 6) fail(W, 'approvals fora de 4–6');
  if (ws.audit.length < 20 || ws.audit.length > 30) fail(W, 'audit fora de ~25');
  ws.audit.forEach((a) => owner(`audit ${a.id}`, a.actor));
  if (ws.executions.length < 25 || ws.executions.length > 35) fail(W, 'executions fora de ~30');
  if (!ws.executions.some((e) => e.guardrail)) fail(W, 'executions: nenhuma com guardrail');
  if (new Set(ws.executions.map((e) => e.result)).size < 3) fail(W, 'executions: resultados pouco variados');
  for (const e of ws.executions) {
    need(`execution ${e.id}`, journeys, e.journeyId);
    need(`execution ${e.id} channel`, channels, e.channel);
    const j = ws.journeys.find((x) => x.id === e.journeyId);
    const nodeIds = new Set(j?.versions.flatMap((v) => v.graph.nodes.map((n) => n.id)));
    e.steps.forEach((s) => need(`execution ${e.id} step`, nodeIds, s.nodeId));
    if (e.at > `${SEED_TODAY}T23:59` || e.at < '2026-10-14') fail(W, `execution ${e.id}: data fora dos últimos 7 dias`);
  }
  for (const m of ws.metrics) {
    if (m.points.length !== 90 || m.points[89].date !== SEED_TODAY) fail(W, `metric ${m.id}: série inválida`);
  }
  for (const view of ['operacao', 'agentica', 'engenharia', 'negocio', 'dados'] as const) {
    if (!ws.metrics.some((m) => m.view === view)) fail(W, `metrics: falta visão ${view}`);
  }
  if (ws.metrics.filter((m) => m.view === 'negocio' && m.baseline !== undefined).length !== 4) fail(W, 'metrics: esperado 4 KPIs de negócio com baseline');
  if (ws.suggestions.length < 2 || ws.suggestions.length > 3) fail(W, 'suggestions fora de 2–3');
  ws.suggestions.forEach((s) => { need(`suggestion ${s.id}`, journeys, s.journeyId); need(`suggestion ${s.id}`, docs, s.sourceDocId); });
  if (!ws.suggestions.some((s) => /32% dos transbordos da jornada/.test(s.evidence))) fail(W, 'suggestions: falta a sugestão dos 32%');
  if (ws.cockpit.funnel.length !== 5 || ws.cockpitBefore.funnel.length !== 5) fail(W, 'cockpit: funil incompleto');
}

function main() {
  const t0 = performance.now();
  const a = generateWorkspaces();
  const b = generateWorkspaces();
  const ja = JSON.stringify(a);
  if (ja !== JSON.stringify(b)) errors.push('Determinismo: duas gerações diferentes');
  const order = a.map((w) => w.workspace.id).join(',');
  if (order !== 'ws-saude,ws-varejo,ws-financeiro,ws-telecom') errors.push(`Ordem dos workspaces: ${order}`);
  for (const w of a) {
    if (JSON.stringify(getWorkspace(w.workspace.id)) !== JSON.stringify(w)) errors.push(`getWorkspace(${w.workspace.id}) diverge`);
    validateWorkspace(w);
  }
  for (const [ind, p] of Object.entries(CRM_WIZARD_PRESET)) {
    if (!CONNECTOR_TYPES.some((t) => t.id === p.typeId && t.category === 'crm')) errors.push(`[${ind}] preset CRM com typeId inválido`);
    const pii = new Set(p.objects.flatMap((o) => o.fields.filter((f) => f.pii).map((f) => f.name)));
    for (const f of ['nome', 'cpf', 'email', 'telefone']) if (!pii.has(f)) errors.push(`[${ind}] preset CRM: campo ${f} não marcado como PII`);
    if (p.tools.some((t) => t.mode === 'escrita' && t.enabledByEnv.prd)) errors.push(`[${ind}] preset CRM: escrita ligada em Prd`);
    const w = a.find((x) => x.workspace.industry === ind)!;
    if (!w.domains.some((d) => d.id === p.domainId)) errors.push(`[${ind}] preset CRM: domínio inexistente`);
  }
  const bytes = Buffer.byteLength(ja, 'utf8');
  console.log(`Tamanho total: ${(bytes / 1024 / 1024).toFixed(2)} MB`);
  for (const w of a) console.log(`  ${w.workspace.id}: ${(Buffer.byteLength(JSON.stringify(w)) / 1024).toFixed(0)} KB`);
  if (bytes > 3 * 1024 * 1024) errors.push('Tamanho acima de 3 MB');
  console.log(`Geração em ${(performance.now() - t0).toFixed(0)} ms (duas vezes)`);
  if (errors.length) {
    console.error(`\n${errors.length} problema(s):`);
    errors.forEach((e) => console.error(' - ' + e));
    process.exit(1);
  }
  console.log('Seed ok: referências, determinismo, tamanho e padrões da demo.');
}

main();
