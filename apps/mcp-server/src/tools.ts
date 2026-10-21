// Ferramentas MCP do Córtex (seção 8). Leitura filtrada pelo escopo do token;
// escrita muta o estado em memória e registra evento no log.
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { NODE_KINDS } from '@cortex/schemas';
import type {
  Approval, BuildOrder, Journey, JourneyGraph, ProfileId, Validation, WorkspaceData,
} from '@cortex/schemas';
import { bumpVersion, jaccard, score, store, wsOf, type Scope } from './store.js';
import { latestVersion, listResources, renderContractYaml, uriOf } from './resources.js';
import { validate } from './validator.js';

type ToolResult = { content: { type: 'text'; text: string }[]; isError?: boolean };

const ok = (data: unknown): ToolResult => ({ content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] });
const fail = (message: string, extra?: Record<string, unknown>): ToolResult => ({
  content: [{ type: 'text', text: JSON.stringify({ erro: message, ...extra }, null, 2) }],
  isError: true,
});

class ToolError extends Error {
  constructor(message: string, public extra?: Record<string, unknown>) {
    super(message);
  }
}

// ---------- esquemas ----------
const NODE_KIND_IDS = NODE_KINDS.map((k) => k.kind) as [string, ...string[]];
const CATEGORIES = ['gatilho', 'agente', 'conhecimento', 'dados', 'logica', 'pessoas', 'guardrail', 'saida'] as const;

const journeyNodeSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(NODE_KIND_IDS).describe('Tipo do nó, da paleta do Studio (ex.: gatilho.mensagem, agente.agente, guardrail.pii).'),
  category: z.enum(CATEGORIES).optional().describe('Categoria; se omitida, é derivada do kind.'),
  label: z.string().min(1),
  position: z.object({ x: z.number(), y: z.number() }).optional().describe('Posição no canvas; se omitida, o Córtex distribui os nós.'),
  componentId: z.string().optional(),
  componentVersion: z.string().optional(),
  ruleId: z.string().optional().describe('Id da tabela de decisão (nós logica.tabela / conhecimento.regra).'),
  contractId: z.string().optional(),
  toolId: z.string().optional(),
  channelId: z.string().optional(),
  outputs: z.array(z.string()).optional(),
  emitsPii: z.boolean().optional(),
  config: z.record(z.string()).optional(),
});

const journeyGraphSchema = z.object({
  nodes: z.array(journeyNodeSchema).min(1),
  edges: z.array(
    z.object({
      id: z.string().optional(),
      source: z.string(),
      target: z.string(),
      sourceHandle: z.string().optional().describe('Saída nomeada do nó de origem, ex.: "sim", "não", "aprovado".'),
      label: z.string().optional(),
    }),
  ),
});

const validationSchema = z.object({
  checks: z
    .array(
      z.object({
        key: z.enum(['estrategia', 'mercado', 'regras', 'dados', 'integracoes', 'arquitetura', 'reuso', 'business_case']),
        label: z.string(),
        result: z.enum(['verde', 'amarelo', 'vermelho']),
        summary: z.string(),
        source: z.string().describe('Fonte no cérebro (id ou URI cortex://) que sustenta o resultado.'),
      }),
    )
    .min(1),
  recommendation: z.string(),
  attention: z.array(z.string()),
  reusePct: z.number().min(0).max(100),
  solutionType: z.enum(['agente', 'automacao', 'aplicacao', 'integracao', 'produto_de_dados']),
  decision: z.enum(['seguir', 'rever']).optional(),
});

// ---------- auxiliares ----------
function journeyGraphOf(j: Journey, version?: string): JourneyGraph | undefined {
  const v = version ? j.versions.find((x) => x.version === version) : j.versions.at(-1);
  return v?.graph;
}

function ordersInScope(ws: WorkspaceData, scope: Scope): BuildOrder[] {
  return ws.buildOrders.filter((o) => o.env === scope.env);
}

function findOrder(ws: WorkspaceData, scope: Scope, ordemId: string): BuildOrder {
  const o = ws.buildOrders.find((x) => x.id === ordemId);
  if (!o) {
    throw new ToolError(`Ordem de construção "${ordemId}" não encontrada.`, {
      ordensDisponiveis: ordersInScope(ws, scope).map((x) => x.id),
    });
  }
  if (o.env !== scope.env) {
    throw new ToolError(`A ordem ${ordemId} é do ambiente ${o.env}; o token está no ambiente ${scope.env}.`);
  }
  return o;
}

function buildPackage(ws: WorkspaceData, scope: Scope, o: BuildOrder) {
  const journey = ws.journeys.find((j) => j.id === o.journeyId);
  const graph = journey ? journeyGraphOf(journey, o.journeyVersion) : undefined;
  const nodes = graph?.nodes ?? [];
  const ruleIds = new Set(nodes.map((n) => n.ruleId).filter(Boolean) as string[]);
  const contractIds = new Set(nodes.map((n) => n.contractId).filter(Boolean) as string[]);
  const componentIds = new Set(nodes.map((n) => n.componentId).filter(Boolean) as string[]);
  const initiative = ws.initiatives.find((i) => i.id === journey?.initiativeId || i.journeyId === o.journeyId);
  const resources = listResources(scope);
  const total = nodes.length;
  const built = nodes.filter((n) => o.progress[n.id] === 'construido').length;

  return {
    ordem: o,
    progresso: { construidos: built, total, pendentes: nodes.filter((n) => o.progress[n.id] !== 'construido').map((n) => n.id) },
    iniciativa: initiative
      ? { id: initiative.id, titulo: initiative.title, problema: initiative.problem, objetivo: initiative.objective, metrica: initiative.metric }
      : undefined,
    especificacaoFuncional: journey
      ? {
          jornada: { id: journey.id, nome: journey.name, descricao: journey.description, tipo: journey.type, risco: journey.risk, gatilho: journey.triggerLabel, kpis: journey.kpis },
          regras: ws.decisionTables.filter((t) => ruleIds.has(t.id)),
          criteriosDeAceite: o.definitionOfDone,
        }
      : undefined,
    grafo: graph,
    mapaNoParaArtefato: nodes.map((n) => ({
      nodeId: n.id,
      kind: n.kind,
      label: n.label,
      artefatoEsperado: expectedArtifact(n.kind),
      componentId: n.componentId,
      ruleId: n.ruleId,
      contractId: n.contractId,
      toolId: n.toolId,
    })),
    especificacaoTecnica: {
      padroes: resources.filter((r) => r.kind === 'padroes').map((r) => ({ uri: r.uri, nome: r.name })),
      adrs: resources.filter((r) => r.kind === 'adrs').map((r) => ({ uri: r.uri, nome: r.name })),
      stackEvitar: ws.radar.filter((r) => r.ring === 'evitar').map((r) => r.name),
      stackAdotar: ws.radar.filter((r) => r.ring === 'adotar').map((r) => r.name),
    },
    componentes: ws.components
      .filter((c) => componentIds.has(c.id))
      .map((c) => ({ id: c.id, tipo: c.type, nome: c.name, versao: c.version, status: c.status, descricao: c.description })),
    contratos: ws.contracts.filter((c) => contractIds.has(c.id)).map((c) => ({ id: c.id, nome: c.name, uri: uriOf(scope.workspaceId, 'contratos', c.id), odcs: renderContractYaml(c, latestVersion(c)) })),
    casosDeTeste: journey?.testCases ?? [],
    politicas: ws.policies.filter((p) => p.active && p.envs.includes(scope.env)).map((p) => ({ id: p.id, nome: p.name, condicao: p.condition, efeito: p.effect })),
    proximosPassos: [
      'Registrar o plano com registrar_plano e aguardar aprovação do Champion AI.',
      'Implementar nó a nó, chamando validar_contra_padroes a cada etapa.',
      'Chamar registrar_progresso para cada nó concluído.',
      'Rodar os testes gerados a partir dos casosDeTeste, abrir o PR e chamar registrar_evidencia.',
      'Se o desenho precisar mudar, usar propor_mudanca. Nunca alterar regra, contrato ou jornada por conta própria.',
    ],
  };
}

function expectedArtifact(kind: string): string {
  const cat = kind.split('.')[0];
  const map: Record<string, string> = {
    gatilho: 'Handler de entrada (rota HTTP, consumidor de evento ou job agendado) com teste de contrato',
    agente: 'Módulo de agente com prompt versionado, skills do catálogo e avaliação',
    conhecimento: 'Cliente de busca na base de conhecimento ou avaliador da tabela de decisão',
    dados: 'Cliente tipado gerado do contrato/OpenAPI com testes de integração no sandbox de Dev',
    logica: 'Função pura com testes unitários cobrindo cada saída',
    pessoas: 'Integração com fila de atendimento/aprovação e estado de espera',
    guardrail: 'Middleware de guardrail com testes de bloqueio',
    saida: 'Adaptador de canal/notificação com mascaramento de PII',
  };
  return map[cat] ?? 'Módulo de código com testes';
}

function autoLayout(graph: z.infer<typeof journeyGraphSchema>): JourneyGraph {
  const catOf = new Map(NODE_KINDS.map((k) => [k.kind, k.category]));
  return {
    nodes: graph.nodes.map((n, i) => ({
      ...n,
      category: n.category ?? catOf.get(n.kind)!,
      position: n.position ?? { x: 80 + i * 240, y: 200 },
      outputs: n.outputs ?? NODE_KINDS.find((k) => k.kind === n.kind)?.outputs,
    })),
    edges: graph.edges.map((e, i) => ({ ...e, id: e.id ?? `e${i + 1}-${e.source}-${e.target}` })),
  };
}

function checkGraph(ws: WorkspaceData, g: JourneyGraph): { erros: string[]; avisos: string[] } {
  const erros: string[] = [];
  const avisos: string[] = [];
  const ids = new Set<string>();
  for (const n of g.nodes) {
    if (ids.has(n.id)) erros.push(`Nó duplicado: ${n.id}`);
    ids.add(n.id);
    const def = NODE_KINDS.find((k) => k.kind === n.kind);
    if (def && def.category !== n.category) erros.push(`Nó ${n.id}: categoria "${n.category}" não corresponde ao kind ${n.kind} (${def.category}).`);
    if (n.componentId && !ws.components.some((c) => c.id === n.componentId)) avisos.push(`Nó ${n.id}: componente ${n.componentId} não existe no catálogo.`);
    if (n.componentId) {
      const c = ws.components.find((c) => c.id === n.componentId);
      if (c && !['homologado', 'publicado_prd'].includes(c.status)) avisos.push(`Nó ${n.id}: componente ${c.name} está "${c.status}" (não homologado).`);
    }
    if (n.ruleId && !ws.decisionTables.some((t) => t.id === n.ruleId)) avisos.push(`Nó ${n.id}: regra ${n.ruleId} não existe no cérebro.`);
    if (n.contractId && !ws.contracts.some((c) => c.id === n.contractId)) avisos.push(`Nó ${n.id}: contrato ${n.contractId} não existe.`);
  }
  for (const e of g.edges) {
    if (!ids.has(e.source)) erros.push(`Conexão ${e.id}: origem ${e.source} não existe.`);
    if (!ids.has(e.target)) erros.push(`Conexão ${e.id}: destino ${e.target} não existe.`);
  }
  if (!g.nodes.some((n) => n.category === 'gatilho')) avisos.push('A jornada não tem gatilho.');
  if (!g.nodes.some((n) => n.category === 'saida')) avisos.push('A jornada não tem nó de saída.');
  const pii = g.nodes.filter((n) => n.emitsPii);
  const hasPiiGuard = g.nodes.some((n) => n.kind === 'guardrail.pii');
  if (pii.length && !hasPiiGuard) avisos.push(`Nós ${pii.map((n) => n.id).join(', ')} emitem PII e não há Filtro de PII (guardrail.pii) na jornada.`);
  return { erros, avisos };
}

// ---------- registro ----------
type Recorder = (tool: string, fn: () => unknown | Promise<unknown>) => Promise<ToolResult>;

export function registerTools(server: McpServer, scope: Scope, run: Recorder, writeEvent: (tool: string, object: string, detail: string) => void) {
  const ws = () => wsOf(scope);

  // ===== Leitura =====
  server.registerTool(
    'obter_ordem',
    {
      title: 'Obter ordem de construção',
      description:
        'Lê uma ordem de construção (OC) com o pacote completo: jornada e grafo, mapa nó → artefato esperado, regras com tabelas de decisão, contratos ODCS, componentes, casos de teste, políticas e definição de pronto. Informe ordemId, ou jornadaId para a OC mais recente da jornada; sem nada, devolve a OC mais recente do ambiente do token.',
      inputSchema: {
        ordemId: z.string().optional().describe('Id da OC, ex.: oc-123.'),
        jornadaId: z.string().optional().describe('Id da jornada; devolve a OC mais recente dela.'),
      },
      annotations: { readOnlyHint: true },
    },
    ({ ordemId, jornadaId }) =>
      run('obter_ordem', () => {
        const w = ws();
        let order: BuildOrder | undefined;
        if (ordemId) order = findOrder(w, scope, ordemId);
        else {
          const list = ordersInScope(w, scope)
            .filter((o) => !jornadaId || o.journeyId === jornadaId)
            .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
          const anchorIds = new Set(w.journeys.filter((j) => j.anchor).map((j) => j.id));
          order = jornadaId ? list[0] : list.find((o) => anchorIds.has(o.journeyId)) ?? list[0];
        }
        if (!order) {
          throw new ToolError(
            jornadaId ? `Nenhuma OC para a jornada ${jornadaId} no ambiente ${scope.env}.` : `Nenhuma OC no ambiente ${scope.env} deste workspace.`,
            { ordensDisponiveis: ordersInScope(w, scope).map((o) => ({ id: o.id, jornada: o.journeyId, status: o.status })) },
          );
        }
        return buildPackage(w, scope, order);
      }),
  );

  server.registerTool(
    'buscar_regra',
    {
      title: 'Buscar regra de negócio',
      description: 'Busca por texto nas tabelas de decisão e nos componentes do tipo Rule do cérebro. Devolve as regras mais relevantes com linhas, entradas, saídas e origem regulatória.',
      inputSchema: {
        consulta: z.string().min(2).describe('Texto livre, ex.: "elegibilidade de desconto" ou "ANS prazo".'),
        dominioId: z.string().optional().describe('Filtra por domínio.'),
        limite: z.number().int().min(1).max(20).optional().describe('Máximo de resultados (padrão 5).'),
      },
      annotations: { readOnlyHint: true },
    },
    ({ consulta, dominioId, limite }) =>
      run('buscar_regra', () => {
        const w = ws();
        const hits = [
          ...w.decisionTables
            .filter((t) => !dominioId || t.domainId === dominioId)
            .map((t) => ({
              s: score(consulta, `${t.description} ${t.source ?? ''} ${t.inputs.map((i) => i.label).join(' ')} ${t.outputs.map((o) => o.label).join(' ')} ${t.rows.map((r) => r.note ?? '').join(' ')}`, t.name),
              r: { tipo: 'tabela_de_decisao', uri: uriOf(scope.workspaceId, 'regras', t.id), ...t },
            })),
          ...w.components
            .filter((c) => c.type === 'rule' && c.status !== 'depreciado' && (!dominioId || c.domainId === dominioId))
            .map((c) => ({
              s: score(consulta, `${c.description} ${c.content}`, c.name),
              r: { tipo: 'componente_rule', uri: uriOf(scope.workspaceId, 'regras', c.id), id: c.id, nome: c.name, versao: c.version, status: c.status, dominioId: c.domainId, descricao: c.description, conteudo: c.content },
            })),
        ]
          .filter((h) => h.s > 0)
          .sort((a, b) => b.s - a.s)
          .slice(0, limite ?? 5);
        return { consulta, total: hits.length, resultados: hits.map((h) => ({ relevancia: Number(h.s.toFixed(2)), ...h.r })) };
      }),
  );

  server.registerTool(
    'obter_contrato',
    {
      title: 'Obter contrato de dados',
      description: 'Devolve um contrato de dados (padrão ODCS) por id ou nome da entidade, na versão pedida ou na mais recente: campos com classificação (pii, sensível), regras de qualidade, frescor e volume.',
      inputSchema: {
        id: z.string().optional().describe('Id do contrato.'),
        entidade: z.string().optional().describe('Nome da entidade, ex.: "Cliente", "Fatura".'),
        versao: z.string().optional().describe('Versão; padrão: a mais recente.'),
      },
      annotations: { readOnlyHint: true },
    },
    ({ id, entidade, versao }) =>
      run('obter_contrato', () => {
        const w = ws();
        if (!id && !entidade) throw new ToolError('Informe id ou entidade.');
        const n = (s: string) => s.toLowerCase();
        const c = w.contracts.find((x) => (id && x.id === id) || (entidade && (n(x.entity) === n(entidade) || n(x.name) === n(entidade))))
          ?? (entidade ? w.contracts.find((x) => n(x.entity).includes(n(entidade)) || n(x.name).includes(n(entidade))) : undefined);
        if (!c) throw new ToolError('Contrato não encontrado.', { contratos: w.contracts.map((x) => ({ id: x.id, entidade: x.entity, status: x.status })) });
        const v = latestVersion(c, versao);
        if (!v) throw new ToolError(`Versão ${versao} não existe.`, { versoes: c.versions.map((x) => x.version) });
        const { versions, ...meta } = c;
        return {
          ...meta,
          uri: uriOf(scope.workspaceId, 'contratos', c.id),
          versoesDisponiveis: versions.map((x) => x.version),
          versao: v,
          camposPii: v.fields.filter((f) => f.classification === 'pii' || f.classification === 'sensivel').map((f) => f.name),
          odcsYaml: renderContractYaml(c, v),
        };
      }),
  );

  server.registerTool(
    'listar_componentes',
    {
      title: 'Listar componentes do catálogo',
      description: 'Lista componentes do catálogo (skill, agent, rule, mcp, hook, documento, pacote) com filtros por tipo, status e domínio. Use para reutilizar o que já está homologado antes de criar algo novo.',
      inputSchema: {
        tipo: z.enum(['skill', 'agent', 'rule', 'mcp', 'hook', 'documento', 'pacote']).optional(),
        status: z.enum(['rascunho', 'em_revisao', 'homologado', 'publicado_prd', 'depreciado']).optional(),
        dominioId: z.string().optional(),
        texto: z.string().optional().describe('Filtro por texto no nome/descrição.'),
        incluirConteudo: z.boolean().optional().describe('Inclui o conteúdo (instruções/código) de cada componente.'),
      },
      annotations: { readOnlyHint: true },
    },
    ({ tipo, status, dominioId, texto, incluirConteudo }) =>
      run('listar_componentes', () => {
        const list = ws()
          .components.filter((c) => (!tipo || c.type === tipo) && (!status || c.status === status) && (!dominioId || c.domainId === dominioId))
          .filter((c) => !texto || score(texto, c.description, c.name) > 0)
          .map((c) => ({
            id: c.id, tipo: c.type, nome: c.name, versao: c.version, status: c.status, dominioId: c.domainId,
            dono: c.owner, consumidores: c.consumers, avaliacao: c.evaluation.score, descricao: c.description,
            entradas: c.inputs, saidas: c.outputs, dependencias: c.dependencies,
            ...(incluirConteudo ? { conteudo: c.content } : {}),
          }));
        return { total: list.length, componentes: list };
      }),
  );

  server.registerTool(
    'consultar_conhecimento',
    {
      title: 'Consultar base de conhecimento',
      description: 'Responde a uma pergunta com os trechos mais relevantes dos documentos homologados do workspace (com fonte). Para perguntas do roteiro, devolve a recuperação pré-calculada.',
      inputSchema: {
        pergunta: z.string().min(3),
        limite: z.number().int().min(1).max(10).optional().describe('Máximo de trechos (padrão 4).'),
      },
      annotations: { readOnlyHint: true },
    },
    ({ pergunta, limite }) =>
      run('consultar_conhecimento', () => {
        const w = ws();
        const docTitle = (id: string) => w.documents.find((d) => d.id === id)?.title ?? id;
        const best = w.retrievals.map((r) => ({ r, s: jaccard(pergunta, r.question) })).sort((a, b) => b.s - a.s)[0];
        if (best && best.s >= 0.5) {
          return {
            modo: 'recuperacao_pre_calculada',
            perguntaReconhecida: best.r.question,
            resposta: best.r.answer,
            trechos: best.r.results.map((x) => ({
              documento: docTitle(x.docId), docId: x.docId, uri: uriOf(scope.workspaceId, 'documentos', x.docId), trecho: x.chunkIndex, score: x.score,
              texto: w.documents.find((d) => d.id === x.docId)?.chunks[x.chunkIndex],
            })),
          };
        }
        const chunks = w.documents
          .filter((d) => d.status === 'processado')
          .flatMap((d) => d.chunks.map((text, i) => ({ d, i, text, s: score(pergunta, text, d.title) })))
          .filter((c) => c.s > 0)
          .sort((a, b) => b.s - a.s)
          .slice(0, limite ?? 4);
        return {
          modo: 'busca_por_palavras',
          aviso: chunks.length ? undefined : 'Nenhum trecho relevante encontrado. Diga que a base não cobre o assunto em vez de inventar.',
          trechos: chunks.map((c) => ({ documento: c.d.title, docId: c.d.id, uri: uriOf(scope.workspaceId, 'documentos', c.d.id), trecho: c.i, score: Number(c.s.toFixed(2)), texto: c.text })),
        };
      }),
  );

  server.registerTool(
    'validar_contra_padroes',
    {
      title: 'Validar contra os padrões',
      description: 'Verifica código ou descrição contra as regras do projeto: PII (CPF, e-mail etc.) em logs ou respostas sem mascaramento, segredos no código, SQL concatenado e tecnologias no anel Evitar do radar ou proibidas por política de stack. Devolve violações com a regra de origem. Rode a cada etapa da implementação.',
      inputSchema: {
        codigo: z.string().optional().describe('Trecho de código a validar.'),
        descricao: z.string().optional().describe('Descrição de uma solução ou fluxo, quando não há código.'),
        caminhoArquivo: z.string().optional().describe('Caminho do arquivo, para contexto.'),
      },
      annotations: { readOnlyHint: true },
    },
    ({ codigo, descricao, caminhoArquivo }) =>
      run('validar_contra_padroes', () => {
        if (!codigo && !descricao) throw new ToolError('Informe codigo ou descricao.');
        return validate(ws(), { codigo, descricao, caminhoArquivo });
      }),
  );

  server.registerTool(
    'obter_telemetria',
    {
      title: 'Obter telemetria do MCP',
      description: 'Lista os eventos registrados pelo servidor MCP no workspace do token: cada chamada de ferramenta (quem, qual ferramenta, projeto, ambiente) e cada escrita (plano, progresso, evidência, proposta).',
      inputSchema: {
        tipo: z.enum(['telemetria', 'escrita']).optional(),
        desde: z.string().optional().describe('Data ISO; devolve só eventos posteriores.'),
        limite: z.number().int().min(1).max(1000).optional(),
      },
      annotations: { readOnlyHint: true },
    },
    ({ tipo, desde, limite }) =>
      run('obter_telemetria', () => {
        const eventos = store.events({ workspaceId: scope.workspaceId, kind: tipo, since: desde, limit: limite ?? 100 });
        return { total: eventos.length, eventos };
      }),
  );

  // ===== Escrita =====
  server.registerTool(
    'registrar_plano',
    {
      title: 'Registrar plano',
      description: 'Registra no Córtex o plano de implementação de uma OC (passos em ordem). A OC passa a "plano_registrado" e aguarda aprovação do Champion AI antes da implementação.',
      inputSchema: {
        ordemId: z.string(),
        passos: z.array(z.string().min(3)).min(1).describe('Passos do plano, idealmente um por nó ou grupo de nós.'),
        resumo: z.string().optional(),
      },
    },
    ({ ordemId, passos, resumo }) =>
      run('registrar_plano', () => {
        const w = ws();
        const o = findOrder(w, scope, ordemId);
        o.plan = passos;
        o.status = 'plano_registrado';
        const j = w.journeys.find((x) => x.id === o.journeyId);
        for (const n of (j && journeyGraphOf(j, o.journeyVersion)?.nodes) ?? []) o.progress[n.id] ??= 'pendente';
        writeEvent('registrar_plano', o.id, resumo ?? `${passos.length} passos`);
        return { ordemId: o.id, status: o.status, plano: o.plan, mensagem: 'Plano registrado. Aguarde a aprovação do Champion AI no Córtex (ou no terminal) antes de implementar.' };
      }),
  );

  server.registerTool(
    'registrar_progresso',
    {
      title: 'Registrar progresso por nó',
      description: 'Marca um nó da jornada da OC como "construído". A caixinha correspondente acende no Studio.',
      inputSchema: {
        ordemId: z.string(),
        nodeId: z.string().describe('Id do nó do grafo da jornada.'),
        nota: z.string().optional().describe('O que foi construído (arquivos, testes).'),
      },
    },
    ({ ordemId, nodeId, nota }) =>
      run('registrar_progresso', () => {
        const w = ws();
        const o = findOrder(w, scope, ordemId);
        const j = w.journeys.find((x) => x.id === o.journeyId);
        const nodes = (j && journeyGraphOf(j, o.journeyVersion)?.nodes) ?? [];
        if (nodes.length && !nodes.some((n) => n.id === nodeId)) {
          throw new ToolError(`O nó ${nodeId} não existe na jornada ${o.journeyId} v${o.journeyVersion}.`, { nos: nodes.map((n) => ({ id: n.id, label: n.label })) });
        }
        o.progress[nodeId] = 'construido';
        if (o.status === 'na_fila' || o.status === 'plano_registrado') o.status = 'em_construcao';
        const ids = nodes.length ? nodes.map((n) => n.id) : Object.keys(o.progress);
        const built = ids.filter((id) => o.progress[id] === 'construido').length;
        writeEvent('registrar_progresso', `${o.id}#${nodeId}`, nota ?? 'construído');
        return {
          ordemId: o.id, nodeId, estado: 'construido', status: o.status,
          progresso: { construidos: built, total: ids.length, pendentes: ids.filter((id) => o.progress[id] !== 'construido') },
        };
      }),
  );

  server.registerTool(
    'registrar_evidencia',
    {
      title: 'Registrar evidência',
      description: 'Anexa evidência à OC (resultado de testes, relatório de validação, link do PR). Com prUrl, a OC passa a "pronta_revisao" e a evidência vira gate da promoção Dev → Hml.',
      inputSchema: {
        ordemId: z.string(),
        evidencia: z.string().min(3).describe('Descrição objetiva, ex.: "12/12 testes passaram (casos do Studio)".'),
        tipo: z.enum(['testes', 'validacao', 'pr', 'log', 'outro']).optional(),
        prUrl: z.string().optional(),
        tokens: z.number().int().optional().describe('Tokens consumidos na OC até agora.'),
      },
    },
    ({ ordemId, evidencia, tipo, prUrl, tokens }) =>
      run('registrar_evidencia', () => {
        const o = findOrder(ws(), scope, ordemId);
        o.evidences.push(tipo ? `[${tipo}] ${evidencia}` : evidencia);
        if (prUrl) {
          o.prUrl = prUrl;
          o.status = 'pronta_revisao';
        }
        if (tokens !== undefined) o.tokens = tokens;
        writeEvent('registrar_evidencia', o.id, evidencia);
        return { ordemId: o.id, status: o.status, prUrl: o.prUrl, evidencias: o.evidences };
      }),
  );

  server.registerTool(
    'propor_mudanca',
    {
      title: 'Propor mudança no desenho',
      description: 'Abre uma proposta de mudança no Córtex quando a implementação exige alterar o desenho (contrato, regra, componente ou jornada). O dono decide; nunca altere o desenho por conta própria.',
      inputSchema: {
        alvo: z.enum(['contrato', 'regra', 'componente', 'jornada']),
        alvoId: z.string().describe('Id do objeto a mudar.'),
        motivo: z.string().min(5),
        proposta: z.string().min(5).describe('Mudança proposta, de preferência como diff ou lista de campos.'),
        ordemId: z.string().optional(),
      },
    },
    ({ alvo, alvoId, motivo, proposta, ordemId }) =>
      run('propor_mudanca', () => {
        const w = ws();
        const approver: Record<typeof alvo, ProfileId> = { contrato: 'engenheiro_dados', regra: 'dono_negocio', componente: 'coe', jornada: 'champion' };
        const approval: Approval = {
          id: `apr-mcp-${w.approvals.length + 1}-${Date.now().toString(36)}`,
          kind: alvo === 'contrato' ? 'contrato' : 'componente',
          title: `Proposta de mudança (${alvo} ${alvoId}): ${motivo}`.slice(0, 140),
          requestedBy: `Claude Code (${scope.project})`,
          requestedAt: new Date().toISOString(),
          status: 'pendente',
          approverProfile: approver[alvo],
          objectId: alvoId,
          diff: proposta,
          comments: [{ by: 'Claude Code', at: new Date().toISOString(), text: `${motivo}${ordemId ? ` (OC ${ordemId})` : ''}` }],
        };
        w.approvals.unshift(approval);
        writeEvent('propor_mudanca', alvoId, motivo);
        return { propostaId: approval.id, status: 'pendente', aprovador: approval.approverProfile, mensagem: 'Proposta aberta. Não altere o desenho até o dono decidir; siga com o que não depende da mudança.' };
      }),
  );

  server.registerTool(
    'salvar_rascunho_jornada',
    {
      title: 'Salvar rascunho de jornada',
      description: `Salva um rascunho de jornada (grafo JSON) que aparece no Studio para ajuste visual. Com jornadaId existente, cria nova versão; sem ele, cria a jornada. Kinds permitidos: ${NODE_KIND_IDS.join(', ')}.`,
      inputSchema: {
        nome: z.string().min(3),
        descricao: z.string().optional(),
        dominioId: z.string().describe('Domínio de negócio dono da jornada.'),
        tipo: z.enum(['agentica', 'automacao']).optional(),
        jornadaId: z.string().optional(),
        iniciativaId: z.string().optional(),
        grafo: journeyGraphSchema,
        nota: z.string().optional(),
      },
    },
    ({ nome, descricao, dominioId, tipo, jornadaId, iniciativaId, grafo, nota }) =>
      run('salvar_rascunho_jornada', () => {
        if (scope.env !== 'dev') throw new ToolError('Jornadas só podem ser editadas no ambiente Dev (token atual: ' + scope.env + ').');
        const w = ws();
        const graph = autoLayout(grafo);
        const { erros, avisos } = checkGraph(w, graph);
        if (erros.length) throw new ToolError('Grafo inválido.', { erros, avisos });
        const now = new Date().toISOString();
        let j = jornadaId ? w.journeys.find((x) => x.id === jornadaId) : undefined;
        if (jornadaId && !j) throw new ToolError(`Jornada ${jornadaId} não encontrada.`);
        if (j) {
          const version = bumpVersion(j.versions.at(-1)?.version);
          j.versions.push({ version, createdAt: now, author: `Claude Code (${scope.project})`, note: nota ?? 'Rascunho gerado por /cortex:desenhar', graph });
        } else {
          j = {
            id: `jor-mcp-${w.journeys.length + 1}-${Date.now().toString(36)}`,
            name: nome,
            description: descricao ?? '',
            type: tipo ?? 'agentica',
            domainId: dominioId,
            initiativeId: iniciativaId,
            triggerLabel: graph.nodes.find((n) => n.category === 'gatilho')?.label ?? '',
            risk: 'supervisionada',
            brainInputs: [],
            versions: [{ version: '0.1', createdAt: now, author: `Claude Code (${scope.project})`, note: nota ?? 'Rascunho gerado por /cortex:desenhar', graph }],
            envVersions: { dev: null, hml: null, prd: null },
            persona: { name: '', message: '' },
            script: {},
            testCases: [],
            kpis: [],
          };
          w.journeys.push(j);
          if (iniciativaId) {
            const ini = w.initiatives.find((i) => i.id === iniciativaId);
            if (ini && !ini.journeyId) ini.journeyId = j.id;
          }
        }
        const version = j.versions.at(-1)!.version;
        writeEvent('salvar_rascunho_jornada', j.id, `v${version} com ${graph.nodes.length} nós`);
        return { jornadaId: j.id, versao: version, nos: graph.nodes.length, conexoes: graph.edges.length, avisos, mensagem: 'Rascunho salvo. Abra a jornada no Studio para o ajuste visual.' };
      }),
  );

  server.registerTool(
    'registrar_validacao',
    {
      title: 'Registrar validação da iniciativa',
      description: 'Grava o relatório das 8 checagens (estratégia, mercado e regulação, regras, dados, integrações e canais, arquitetura, reuso, business case) na iniciativa, com fonte de cada resultado.',
      inputSchema: {
        iniciativaId: z.string(),
        validacao: validationSchema,
      },
    },
    ({ iniciativaId, validacao }) =>
      run('registrar_validacao', () => {
        const w = ws();
        const ini = w.initiatives.find((i) => i.id === iniciativaId);
        if (!ini) throw new ToolError(`Iniciativa ${iniciativaId} não encontrada.`, { iniciativas: w.initiatives.map((i) => ({ id: i.id, titulo: i.title, estagio: i.stage })) });
        ini.validation = validacao as Validation;
        if (ini.stage === 'ideia') ini.stage = 'validacao';
        const reds = validacao.checks.filter((c) => c.result === 'vermelho').length;
        ini.health = reds ? 'risco' : validacao.checks.some((c) => c.result === 'amarelo') ? 'atencao' : 'ok';
        writeEvent('registrar_validacao', ini.id, validacao.recommendation);
        const missing = ['estrategia', 'mercado', 'regras', 'dados', 'integracoes', 'arquitetura', 'reuso', 'business_case'].filter((k) => !validacao.checks.some((c) => c.key === k));
        return { iniciativaId: ini.id, estagio: ini.stage, saude: ini.health, checagens: validacao.checks.length, checagensFaltando: missing };
      }),
  );

  server.registerTool(
    'criar_historia_itsm',
    {
      title: 'Criar história no ITSM',
      description: 'Cria uma história (user story) na ferramenta de ITSM/engenharia conectada, ligada à OC ou à jornada, com critérios de aceite.',
      inputSchema: {
        titulo: z.string().min(5),
        descricao: z.string().min(5),
        criteriosAceite: z.array(z.string()).optional(),
        prioridade: z.enum(['baixa', 'media', 'alta']).optional(),
        ordemId: z.string().optional(),
        jornadaId: z.string().optional(),
      },
    },
    ({ titulo, descricao, criteriosAceite, prioridade, ordemId, jornadaId }) =>
      run('criar_historia_itsm', () => {
        const itsm = ws().connectors.find((c) => /itsm|jira|servicenow|azure.?devops/i.test(`${c.typeId} ${c.name}`));
        const story = store.addStory({
          workspaceId: scope.workspaceId, title: titulo, description: descricao, acceptanceCriteria: criteriosAceite ?? [],
          priority: prioridade ?? 'media', buildOrderId: ordemId, journeyId: jornadaId, createdAt: new Date().toISOString(), createdBy: `Claude Code (${scope.project})`,
        });
        writeEvent('criar_historia_itsm', story.key, titulo);
        return { chave: story.key, sistema: itsm?.name ?? 'ITSM simulado', status: 'criada', historia: story };
      }),
  );
}

export { ToolError, ok, fail };
