// Testes do motor: npx -y tsx packages/engine/scripts/test.ts
import assert from 'node:assert/strict';
import { NODE_KINDS } from '@cortex/schemas';
import type {
  Component,
  Connector,
  DataContract,
  DecisionTable,
  Journey,
  JourneyGraph,
  Policy,
  WorkspaceData,
} from '@cortex/schemas';
import {
  addNode,
  bumpVersion,
  canPromote,
  connect,
  contractToYaml,
  describePolicy,
  diffContractFields,
  diffGraphs,
  evaluateDecisionTable,
  evaluateGates,
  evaluatePolicies,
  findBreakingConsumers,
  formatBRL,
  formatNumber,
  graphToJson,
  isConnectionAllowed,
  maskPii,
  matchCondition,
  parseOpenApi,
  relativeTime,
  removeNodes,
  SAMPLE_OPENAPI_SPEC,
  simulateJourney,
  simulateJourneyStream,
  suggestBump,
  suggestNextKinds,
  summarizeTrace,
  validateGraph,
} from '../src/index';

let passed = 0;
const tests: { name: string; fn: () => void | Promise<void> }[] = [];
const test = (name: string, fn: () => void | Promise<void>) => tests.push({ name, fn });

// ---------- Fixtures ----------
const graph: JourneyGraph = {
  nodes: [
    { id: 'g1', kind: 'gatilho.mensagem', category: 'gatilho', label: 'Mensagem WhatsApp', position: { x: 0, y: 0 } },
    { id: 'a1', kind: 'agente.intencao', category: 'agente', label: 'Classificar intenção', position: { x: 300, y: 0 }, componentId: 'c-agent' },
    { id: 'c1', kind: 'logica.condicao', category: 'logica', label: 'É fatura?', position: { x: 600, y: 0 }, outputs: ['sim', 'não'] },
    { id: 'd1', kind: 'dados.tool', category: 'dados', label: 'Consultar fatura', position: { x: 900, y: 0 }, toolId: 't-consulta', emitsPii: true, contractId: 'ct-fatura' },
    { id: 'r1', kind: 'saida.responder', category: 'saida', label: 'Responder no WhatsApp', position: { x: 1100, y: 0 }, channelId: 'ch-wa' },
    { id: 'h1', kind: 'pessoas.transbordo', category: 'pessoas', label: 'Transbordo', position: { x: 900, y: 200 } },
  ],
  edges: [
    { id: 'e1', source: 'g1', target: 'a1' },
    { id: 'e2', source: 'a1', target: 'c1' },
    { id: 'e3', source: 'c1', target: 'd1', sourceHandle: 'sim' },
    { id: 'e4', source: 'c1', target: 'h1', sourceHandle: 'não' },
    { id: 'e5', source: 'd1', target: 'r1' },
  ],
};

const journey: Journey = {
  id: 'j1',
  name: 'Segunda via de fatura',
  description: '',
  type: 'agentica',
  domainId: 'dom-fat',
  triggerLabel: 'Mensagem no WhatsApp',
  risk: 'supervisionada',
  brainInputs: [],
  versions: [{ version: '1.0.0', createdAt: '2026-10-01T10:00:00Z', author: 'Ana', note: '', graph }],
  envVersions: { dev: '1.0.0', hml: null, prd: '1.0.0' },
  persona: { name: 'Marina', message: 'Quero a segunda via, meu CPF é 123.456.789-09' },
  script: {
    g1: { input: 'Quero a segunda via', output: 'Quero a segunda via, meu CPF é 123.456.789-09', tokens: 0, latencyMs: 20, costBRL: 0 },
    a1: { input: 'Quero a segunda via', output: 'intenção: segunda_via', tokens: 420, latencyMs: 800, costBRL: 0.012 },
    c1: { input: 'segunda_via', output: 'sim', tokens: 0, latencyMs: 10, costBRL: 0, takeHandle: 'sim' },
    d1: { input: 'cpf 123.456.789-09', output: 'Fatura R$ 189,90 de Marina, CPF 123.456.789-09', tokens: 0, latencyMs: 300, costBRL: 0.001 },
    __pii_filter__: { input: 'Fatura de Marina, CPF 123.456.789-09', output: 'Fatura de M***, CPF ***.456.789-**', tokens: 0, latencyMs: 30, costBRL: 0 },
  },
  testCases: [{ id: 'tc1', name: 'Pedido simples', input: 'segunda via', expected: 'link', lastResult: 'passou' }],
  kpis: [],
};

function comp(id: string, name: string, type: Component['type'], status: Component['status'], score = 4.6): Component {
  return {
    id, type, name, version: '1.0.0', status, owner: 'CoE', consumers: 1, rating: 4, description: '', content: '',
    inputs: [], outputs: [], dependencies: [], changelog: [], evaluation: { score, cases: 10, passed: 9 }, approvals: [],
  };
}

const connector: Connector = {
  id: 'cn-fat', typeId: 'rest', name: 'API de Faturas', status: 'conectado',
  envs: { dev: { endpoint: 'https://dev', secretRef: 'kv://dev' }, hml: { endpoint: 'https://hml', secretRef: 'kv://hml' } },
  syncMode: 'sob_demanda', lastSync: '', volume: 0, latencyMs: 100, consumers: [], objects: [], logs: [],
  tools: [
    { id: 't-consulta', name: 'consultar_fatura', description: '', mode: 'leitura', enabledByEnv: { dev: true, hml: true, prd: true } },
    { id: 't-contestar', name: 'abrir_contestacao', description: '', mode: 'escrita', enabledByEnv: { dev: true, hml: true, prd: true } },
  ],
};

const contract: DataContract = {
  id: 'ct-fatura', name: 'Fatura', domainId: 'dom-fat', entity: 'Fatura', owner: 'Dados', status: 'publicado',
  versions: [
    {
      version: '1.2.0', publishedAt: '2026-09-01', author: 'Bia', note: 'Inclui linha digitável', freshness: '15 min', expectedVolume: '1,2 mi/dia',
      fields: [
        { name: 'id', type: 'string', required: true, classification: 'interno', description: 'Identificador' },
        { name: 'cpf', type: 'string', required: true, classification: 'pii', description: 'CPF do titular: formato 000.000.000-00', ref: 'Cliente.cpf' },
        { name: 'valor', type: 'number', required: true, classification: 'interno', description: 'Valor' },
      ],
      quality: [{ id: 'q1', kind: 'completude', field: 'cpf', expression: 'not_null(cpf)', lastResult: 'ok', history: [100, 99] }],
    },
  ],
};

const policies: Policy[] = [
  {
    id: 'p1', name: 'Dinheiro exige aprovação', kind: 'jornada', description: '', condition: '', effect: 'exigir_aprovacao', envs: ['prd'], active: true,
    code: JSON.stringify({ when: { amountBRL: { gt: 5000 }, risk: { in: ['autonoma', 'supervisionada'] } }, then: 'exigir_aprovacao' }),
  },
  {
    id: 'p2', name: 'Hml sem CPF aberto', kind: 'dado', description: '', condition: '', effect: 'bloquear', envs: ['hml'], active: true,
    code: JSON.stringify({ when: { dataClassifications: { contains: 'pii' }, masked: false }, then: 'bloquear' }),
  },
  { id: 'p3', name: 'Quebrada', kind: 'stack', description: '', condition: '', effect: 'alertar', envs: ['prd'], active: true, code: '{oops' },
  {
    id: 'p4', name: 'Nota mínima', kind: 'jornada', description: '', condition: '', effect: 'bloquear', envs: ['prd'], active: true,
    code: JSON.stringify({ when: { evaluationScore: { lt: 4.2 } }, then: 'bloquear' }),
  },
];

const data = {
  components: [comp('c-agent', 'Agente de fatura', 'agent', 'homologado'), comp('c-hook', 'Mascarar PII antes do canal', 'hook', 'homologado')],
  decisionTables: [],
  contracts: [contract],
  connectors: [connector],
  journeys: [journey],
  policies,
} as unknown as WorkspaceData;

// ---------- Jornada ----------
test('simulateJourney segue takeHandle e para no responder', () => {
  const steps = simulateJourney(journey, graph);
  assert.deepEqual(steps.map((s) => s.nodeId), ['g1', 'a1', 'c1', 'd1', 'r1']);
  assert.equal(steps[4].tokens, 0);
  assert.equal(steps[4].latencyMs, 40);
  const t = summarizeTrace(steps);
  assert.equal(t.tokens, 420);
  assert.equal(t.latencyMs, 20 + 800 + 10 + 300 + 40);
  assert.equal(t.costBRL, 0.013);
});

test('simulateJourney toma o caminho "não" e protege contra ciclo', () => {
  const j2 = { ...journey, script: { ...journey.script, c1: { ...journey.script.c1, takeHandle: 'não' } } };
  assert.deepEqual(simulateJourney(j2, graph).map((s) => s.nodeId), ['g1', 'a1', 'c1', 'h1']);
  const loop: JourneyGraph = {
    nodes: [graph.nodes[0], graph.nodes[1]],
    edges: [{ id: 'x', source: 'g1', target: 'a1' }, { id: 'y', source: 'a1', target: 'a1' }],
  };
  assert.equal(simulateJourney(journey, loop).length, 50);
});

test('filtro de PII usa __pii_filter__ e fica em alerta', () => {
  const problem = validateGraph(graph, { data, env: 'dev' }).find((p) => p.code === 'pii_sem_filtro')!;
  const fixed = problem.fix!.apply(graph);
  const steps = simulateJourney(journey, fixed);
  const f = steps.find((s) => s.nodeId === 'pii-filter-1')!;
  assert.equal(f.status, 'alerta');
  assert.match(f.output, /\*\*\*/);
});

test('simulateJourneyStream emite com atraso e pode ser cancelado', async () => {
  const got: string[] = [];
  await new Promise<void>((resolve) => {
    simulateJourneyStream(journey, graph, (s) => got.push(s.nodeId), { speed: 10, onDone: () => resolve() });
  });
  assert.equal(got.length, 5);
  const got2: string[] = [];
  const h = simulateJourneyStream(journey, graph, (s) => got2.push(s.nodeId), { speed: 10 });
  h.cancel();
  await new Promise((r) => setTimeout(r, 300));
  assert.equal(got2.length, 0);
});

// ---------- Validação ----------
test('validateGraph acusa PII sem filtro e corrige', () => {
  const problems = validateGraph(graph, { data, env: 'dev' });
  const pii = problems.find((p) => p.code === 'pii_sem_filtro');
  assert.ok(pii);
  assert.equal(pii!.severity, 'erro');
  assert.equal(pii!.message, 'Dado PII de «Consultar fatura» chega ao canal sem filtro');
  assert.equal(pii!.fix!.label, 'Inserir filtro de PII');
  const fixed = pii!.fix!.apply(graph);
  const filter = fixed.nodes.find((n) => n.id === 'pii-filter-1')!;
  assert.equal(filter.kind, 'guardrail.pii');
  assert.equal(filter.componentId, 'c-hook');
  assert.ok(fixed.edges.some((e) => e.source === 'd1' && e.target === 'pii-filter-1'));
  assert.ok(fixed.edges.some((e) => e.source === 'pii-filter-1' && e.target === 'r1'));
  // Espaço aberto: o nó de resposta foi deslocado para a direita.
  const r1 = fixed.nodes.find((n) => n.id === 'r1')!;
  assert.ok(filter.position.x > 900 && filter.position.x < r1.position.x);
  assert.equal(validateGraph(fixed, { data, env: 'dev' }).filter((p) => p.severity === 'erro').length, 0);
});

test('validateGraph: gatilho, desconectado, componente, saídas, autonomia', () => {
  const g: JourneyGraph = {
    nodes: [
      { id: 'a', kind: 'agente.agente', category: 'agente', label: 'Agente', position: { x: 0, y: 0 }, componentId: 'c-x' },
      { id: 'b', kind: 'logica.condicao', category: 'logica', label: 'Cond', position: { x: 0, y: 0 }, outputs: ['sim', 'não'] },
      { id: 'z', kind: 'saida.encerrar', category: 'saida', label: 'Fim', position: { x: 0, y: 0 } },
      { id: 'q', kind: 'agente.resumir', category: 'agente', label: 'Solto', position: { x: 0, y: 0 }, componentId: 'c-draft', ruleId: 'nope' },
    ],
    edges: [{ id: 'e', source: 'a', target: 'b' }, { id: 'f', source: 'b', target: 'z', sourceHandle: 'sim' }],
  };
  const d2 = { ...data, components: [...data.components, comp('c-draft', 'Rascunho', 'skill', 'rascunho')] } as WorkspaceData;
  const codes = (env: 'dev' | 'prd') => validateGraph(g, { data: d2, env, risk: 'autonoma' });
  const dev = codes('dev');
  const has = (c: string) => dev.some((p) => p.code === c);
  assert.ok(has('sem_gatilho'));
  assert.ok(has('no_desconectado'));
  assert.ok(has('componente_inexistente'));
  assert.ok(has('regra_inexistente'));
  assert.ok(has('saida_sem_ligacao'));
  assert.ok(has('autonoma_sem_humano'));
  assert.equal(dev.find((p) => p.code === 'componente_nao_homologado')!.severity, 'aviso');
  assert.equal(codes('prd').find((p) => p.code === 'componente_nao_homologado')!.severity, 'erro');
  assert.equal(dev[0].severity, 'erro');
});

// ---------- Gates ----------
test('gates Dev→Hml', () => {
  const fixed = validateGraph(graph, { data, env: 'hml' }).find((p) => p.fix)!.fix!.apply(graph);
  const version = { ...journey.versions[0], graph: fixed };
  let gates = evaluateGates({ journey, version, from: 'dev', to: 'hml', data, approvals: {} });
  assert.deepEqual(gates.map((g) => g.id), ['sem_bloqueantes', 'testes', 'componentes_homologados', 'credenciais', 'aprovacao_champion']);
  assert.equal(canPromote(gates), false);
  assert.equal(gates.find((g) => !g.passed)!.id, 'aprovacao_champion');
  gates = evaluateGates({ journey, version, from: 'dev', to: 'hml', data, approvals: { champion: true } });
  assert.equal(canPromote(gates), true);
  // Sem o filtro, o gate de bloqueantes reprova e aponta o nó.
  const raw = evaluateGates({ journey, version: journey.versions[0], from: 'dev', to: 'hml', data, approvals: { champion: true } });
  const g0 = raw.find((g) => g.id === 'sem_bloqueantes')!;
  assert.equal(g0.passed, false);
  assert.equal(g0.nodeId, 'd1');
});

test('gates Hml→Prd', () => {
  const fixed = validateGraph(graph, { data, env: 'prd' }).find((p) => p.fix)!.fix!.apply(graph);
  const version = { ...journey.versions[0], graph: fixed };
  const gates = evaluateGates({ journey, version, from: 'hml', to: 'prd', data, approvals: { coe: true } });
  const byId = Object.fromEntries(gates.map((g) => [g.id, g]));
  assert.equal(byId.credenciais.passed, false);
  assert.match(byId.credenciais.reason!, /Prd/);
  assert.equal(byId.nota_avaliacao.passed, true); // 4,6 ≥ 4,2
  assert.equal(byId.nota_avaliacao.label, 'Nota de avaliação ≥ 4,2');
  assert.equal(byId.contratos.passed, true);
  assert.equal(byId.politicas_prd.passed, true);
  assert.equal(byId.aprovacao_coe.passed, true);
  assert.equal(byId.aprovacao_dono.passed, false);
  assert.equal(byId.aprovacao_dono.approver, 'dono_negocio');
  // Tool de escrita sem política em Prd reprova.
  const withWrite: JourneyGraph = {
    nodes: [...fixed.nodes, { id: 'w', kind: 'dados.tool', category: 'dados', label: 'Contestar', position: { x: 0, y: 300 }, toolId: 't-contestar' }],
    edges: [...fixed.edges, { id: 'ew', source: 'h1', target: 'w' }],
  };
  const g2 = evaluateGates({ journey, version: { ...version, graph: withWrite }, from: 'hml', to: 'prd', data, approvals: { coe: true, owner: true } });
  assert.equal(g2.find((g) => g.id === 'politicas_prd')!.passed, false);
});

// ---------- Tabela de decisão ----------
test('matchCondition cobre a sintaxe', () => {
  assert.ok(matchCondition('*', 'x'));
  assert.ok(matchCondition('>=18', 18));
  assert.ok(!matchCondition('>18', 18));
  assert.ok(matchCondition('<5000', '4999'));
  assert.ok(matchCondition('<=5', 5));
  assert.ok(matchCondition('10..20', 20));
  assert.ok(!matchCondition('10..20', 20.5));
  assert.ok(matchCondition('1.5..2,5', 2));
  assert.ok(matchCondition('Ouro|Prata', 'prata'));
  assert.ok(matchCondition('=SP', 'sp'));
  assert.ok(matchCondition('!=SP', 'RJ'));
  assert.ok(!matchCondition('!=sp|rj', 'RJ'));
  assert.ok(matchCondition('true', true));
  assert.ok(!matchCondition('false', true));
  assert.ok(matchCondition('3', 3));
  assert.ok(!matchCondition('>3', undefined));
});

test('evaluateDecisionTable: primeira linha vence, com trace', () => {
  const table: DecisionTable = {
    id: 'dt', name: 'Alçada', domainId: 'd', description: '', version: '1', inputs: [], outputs: [{ key: 'acao', label: 'Ação' }],
    sampleCase: {},
    rows: [
      { id: 'r1', conditions: { valor: '>5000', vip: 'false' }, outputs: { acao: 'aprovacao_humana' } },
      { id: 'r2', conditions: { valor: '0..5000', vip: '*' }, outputs: { acao: 'automatico' } },
      { id: 'r3', conditions: { valor: '*', vip: 'true' }, outputs: { acao: 'vip' } },
    ],
  };
  const r = evaluateDecisionTable(table, { valor: 7000, vip: true });
  assert.equal(r.row!.id, 'r3');
  assert.equal(r.matchedIndex, 2);
  assert.equal(r.trace.filter((t) => t.rowId === 'r1').length, 2);
  assert.equal(evaluateDecisionTable(table, { valor: 100, vip: false }).row!.outputs.acao, 'automatico');
  assert.equal(evaluateDecisionTable(table, { valor: 9000, vip: false }).row!.id, 'r1');
  assert.equal(evaluateDecisionTable({ ...table, rows: [table.rows[0]] }, { valor: 1, vip: false }).matchedIndex, -1);
});

// ---------- Políticas ----------
test('evaluatePolicies e describePolicy', () => {
  const hits = evaluatePolicies(policies, { env: 'prd', amountBRL: 8000, risk: 'supervisionada' });
  assert.deepEqual(hits.map((h) => h.policyId), ['p1']);
  assert.equal(hits[0].effect, 'exigir_aprovacao');
  assert.equal(evaluatePolicies(policies, { env: 'prd', amountBRL: 100, risk: 'supervisionada' }).length, 0);
  assert.equal(evaluatePolicies(policies, { env: 'hml', dataClassifications: ['pii', 'interno'], masked: false })[0].effect, 'bloquear');
  assert.equal(evaluatePolicies(policies, { env: 'hml', dataClassifications: ['interno'], masked: false }).length, 0);
  assert.equal(describePolicy(policies[0].code), 'quando o valor (R$) é maior que 5.000 e o risco da jornada está entre autônoma ou supervisionada então exigir aprovação');
  assert.equal(describePolicy('{oops'), 'regra inválida');
});

// ---------- Contratos ----------
test('diff, quebra, versão e YAML de contrato', () => {
  const cur = contract.versions[0].fields;
  const next = [
    { ...cur[0] },
    { ...cur[2], type: 'string' },
    { name: 'linhaDigitavel', type: 'string', required: false, classification: 'interno' as const, description: '' },
  ];
  const diff = diffContractFields(cur, next);
  assert.deepEqual(diff.removed.map((f) => f.name), ['cpf']);
  assert.deepEqual(diff.added.map((f) => f.name), ['linhaDigitavel']);
  assert.deepEqual(diff.changed[0].changes, ['tipo: number → string']);
  assert.equal(suggestBump(diff), 'major');
  assert.equal(suggestBump(diffContractFields(cur, [...cur, next[2]])), 'minor');
  assert.equal(suggestBump(diffContractFields(cur, cur)), 'patch');
  assert.equal(bumpVersion('1.2.3', 'major'), '2.0.0');
  assert.equal(bumpVersion('v1.2.3', 'minor'), '1.3.0');
  assert.equal(bumpVersion('1.2', 'patch'), '1.2.1');

  const broken = findBreakingConsumers(contract, next, data);
  assert.deepEqual(broken.map((b) => b.field).sort(), ['cpf', 'valor']);
  assert.equal(broken[0].journeyName, 'Segunda via de fatura');
  assert.equal(broken[0].env, 'prd');
  // Nó que declara só os campos usados.
  const j2 = structuredClone(journey);
  j2.versions[0].graph.nodes.find((n) => n.id === 'd1')!.config = { fields: 'id, valor' };
  const b2 = findBreakingConsumers(contract, next, { ...data, journeys: [j2] } as WorkspaceData);
  assert.deepEqual(b2.map((b) => b.field), ['valor']);
  assert.equal(findBreakingConsumers(contract, [...cur, next[2]], data).length, 0);

  const yaml = contractToYaml(contract, '1.2.0');
  assert.match(yaml, /^apiVersion: v3\.0\.0\nkind: DataContract\nid: ct-fatura\n/);
  assert.match(yaml, /version: 1\.2\.0/);
  assert.match(yaml, /status: active/);
  assert.match(yaml, /    properties:\n      - name: id\n        logicalType: string\n        required: true\n        classification: interno/);
  assert.match(yaml, /description: "CPF do titular: formato 000\.000\.000-00"/);
  assert.match(yaml, /slaProperties:\n  - property: freshness\n    value: 15 min/);
  assert.match(yaml, /quality:\n      - id: q1/);
});

// ---------- OpenAPI ----------
test('parseOpenApi com a especificação de exemplo', () => {
  const r = parseOpenApi(SAMPLE_OPENAPI_SPEC);
  assert.equal(r.title, 'API de Faturas');
  assert.equal(r.baseUrl, 'https://api.exemplo.com.br/faturas/v2');
  assert.deepEqual(r.errors, []);
  assert.equal(r.tools.length, 6);
  const t = Object.fromEntries(r.tools.map((x) => [x.name, x]));
  assert.equal(t.consultar_fatura.mode, 'leitura');
  assert.equal(t.consultar_fatura.enabledByEnv.prd, true);
  assert.equal(t.gerar_segunda_via.mode, 'escrita');
  assert.equal(t.gerar_segunda_via.enabledByEnv.prd, false);
  assert.ok(t.atualizar_email_de_cobranca);
  const cliente = r.objects.find((o) => o.name === 'Cliente')!;
  const pii = cliente.fields.filter((f) => f.pii).map((f) => f.name);
  assert.deepEqual(pii, ['nome', 'cpf', 'email', 'telefone', 'dataNascimento']);
  assert.equal(cliente.sample[0].nome, 'Marina Albuquerque');
});

test('parseOpenApi: Swagger 2.0 sem operationId e entradas inválidas', () => {
  const r = parseOpenApi({
    swagger: '2.0', info: { title: 'Legado', version: '1' }, host: 'erp.local', basePath: '/v1', schemes: ['http'],
    paths: { '/pedidos/{id}': { get: { summary: 'Pedido' }, delete: {} }, '/pedidos': { get: {}, post: {} } },
    definitions: { Pedido: { properties: { id: { type: 'integer' }, itens: { type: 'array', items: { $ref: '#/definitions/Item' } } } } },
  });
  assert.equal(r.baseUrl, 'http://erp.local/v1');
  assert.deepEqual(r.tools.map((t) => t.name), ['consultar_pedidos_por_id', 'remover_pedidos_por_id', 'listar_pedidos', 'criar_pedidos']);
  assert.equal(r.tools[1].description, 'DELETE /pedidos/{id}');
  assert.equal(r.objects[0].fields[1].type, 'array<Item>');
  assert.ok(parseOpenApi('not json').errors.length);
  assert.ok(parseOpenApi(42).errors.length);
  assert.ok(parseOpenApi(JSON.stringify(SAMPLE_OPENAPI_SPEC)).tools.length === 6);
});

// ---------- Edição de grafo ----------
test('addNode, connect, removeNodes, diffGraphs, sugestões', () => {
  const kind = (k: string) => NODE_KINDS.find((x) => x.kind === k)!;
  let g: JourneyGraph = { nodes: [], edges: [] };
  const a = addNode(g, kind('gatilho.mensagem'), { x: 0, y: 0 });
  g = a.graph;
  const b = addNode(g, kind('logica.condicao'), { x: 200, y: 0 });
  g = b.graph;
  assert.deepEqual(b.node.outputs, ['sim', 'não']);
  const c = addNode(g, kind('saida.encerrar'), { x: 400, y: 0 });
  g = c.graph;
  assert.equal(a.node.id, 'mensagem-1');
  g = connect(g, a.node.id, b.node.id);
  g = connect(g, b.node.id, c.node.id);
  assert.equal(g.edges[1].sourceHandle, 'sim');
  assert.equal(connect(g, a.node.id, b.node.id), g); // duplicada
  assert.equal(isConnectionAllowed(g, b.node.id, a.node.id).allowed, false); // para gatilho
  assert.equal(isConnectionAllowed(g, c.node.id, b.node.id).allowed, false); // de encerrar
  assert.equal(isConnectionAllowed(g, b.node.id, b.node.id).allowed, false); // laço
  assert.equal(isConnectionAllowed(g, b.node.id, c.node.id, 'não').allowed, true);
  const g2 = removeNodes(g, [b.node.id]);
  assert.equal(g2.nodes.length, 2);
  assert.equal(g2.edges.length, 0);
  const g3 = { ...g, nodes: g.nodes.map((n) => (n.id === c.node.id ? { ...n, label: 'Fim' } : n)) };
  const d = diffGraphs(g2, g3);
  assert.deepEqual(d, { added: [b.node.id], removed: [], changed: [c.node.id] });
  assert.deepEqual(suggestNextKinds(graph, 'g1').slice(0, 1), ['agente.agente']); // intenção já ligada
  assert.equal(suggestNextKinds(graph, 'd1')[0], 'guardrail.pii');
  assert.deepEqual(suggestNextKinds(g, c.node.id), []);
  assert.deepEqual(JSON.parse(graphToJson(g)), g);
});

// ---------- Formatação ----------
test('maskPii, formatBRL, formatNumber, relativeTime', () => {
  assert.equal(maskPii('CPF 123.456.789-09'), 'CPF ***.456.789-**');
  assert.equal(maskPii('cpf 12345678909'), 'cpf ***.456.789-**');
  assert.equal(maskPii('mail marina@exemplo.com.br'), 'mail m***@exemplo.com.br');
  assert.equal(maskPii('tel (11) 98765-4321'), 'tel (11) *****-4321');
  assert.equal(maskPii('CNPJ 12.345.678/0001-95'), 'CNPJ **.***.***/0001-**');
  assert.equal(maskPii('sem dado pessoal, fatura R$ 189,90'), 'sem dado pessoal, fatura R$ 189,90');
  assert.equal(formatBRL(1234.5), 'R$ 1.234,50');
  assert.equal(formatNumber(1234567.891), '1.234.567,89');
  const now = '2026-10-21T12:00:00Z';
  assert.equal(relativeTime('2026-10-21T09:00:00Z', now), 'há 3 h');
  assert.equal(relativeTime('2026-10-21T11:55:00Z', now), 'há 5 min');
  assert.equal(relativeTime('2026-10-21T11:59:40Z', now), 'agora');
  assert.equal(relativeTime('2026-10-20T10:00:00Z', now), 'ontem');
  assert.equal(relativeTime('2026-10-11T12:00:00Z', now), 'há 10 d');
  assert.equal(relativeTime('2026-07-21T12:00:00Z', now), 'há 3 meses');
  assert.equal(relativeTime('2024-10-01T12:00:00Z', now), 'há 2 anos');
  assert.equal(relativeTime('2026-10-21T14:00:00Z', now), 'em 2 h');
});

(async () => {
  let failed = 0;
  for (const t of tests) {
    try {
      await t.fn();
      passed++;
      console.log(`ok   ${t.name}`);
    } catch (e) {
      failed++;
      console.error(`FAIL ${t.name}\n${(e as Error).stack ?? e}`);
    }
  }
  console.log(`\n${passed} passaram, ${failed} falharam`);
  if (failed) process.exit(1);
})();
