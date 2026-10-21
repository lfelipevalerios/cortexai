// Recursos MCP (seção 8): regras de negócio, padrões técnicos, ADRs, contratos de dados,
// documentos homologados e políticas do projeto. URI: cortex://<workspaceId>/<kind>/<id>
import { ResourceTemplate, type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type {
  BrainArtifact, Component, ContractVersion, DataContract, DecisionTable, KnowledgeDocument, Policy, WorkspaceData,
} from '@cortex/schemas';
import { store, wsOf, type Scope } from './store.js';

export const RESOURCE_KINDS = ['regras', 'padroes', 'adrs', 'contratos', 'documentos', 'politicas'] as const;
export type ResourceKind = (typeof RESOURCE_KINDS)[number];

const KIND_LABEL: Record<ResourceKind, string> = {
  regras: 'Regra de negócio',
  padroes: 'Padrão técnico',
  adrs: 'ADR',
  contratos: 'Contrato de dados',
  documentos: 'Documento homologado',
  politicas: 'Política',
};

export interface ResourceEntry {
  uri: string;
  kind: ResourceKind;
  id: string;
  name: string;
  description: string;
  mimeType: string;
  render: () => string;
}

export const uriOf = (wsId: string, kind: ResourceKind, id: string) => `cortex://${wsId}/${kind}/${encodeURIComponent(id)}`;

// ---------- renderizadores ----------
export function renderDecisionTable(t: DecisionTable): string {
  const head = [...t.inputs.map((i) => i.label), ...t.outputs.map((o) => `→ ${o.label}`)];
  const lines = [
    `# ${t.name} (v${t.version})`,
    '',
    t.description,
    '',
    `- Id: \`${t.id}\``,
    `- Domínio: ${t.domainId}`,
    t.source ? `- Origem: ${t.source}` : null,
    t.componentId ? `- Componente: ${t.componentId}` : null,
    '',
    '## Tabela de decisão',
    '',
    `| ${head.join(' | ')} | Nota |`,
    `|${head.map(() => '---').join('|')}|---|`,
    ...t.rows.map(
      (r) => `| ${[...t.inputs.map((i) => r.conditions[i.key] ?? '*'), ...t.outputs.map((o) => r.outputs[o.key] ?? '')].join(' | ')} | ${r.note ?? ''} |`,
    ),
    '',
    'Sintaxe das condições: "*" qualquer, "=v", "!=v", ">=n", "<=n", ">n", "<n", "a..b" faixa inclusiva, "v1|v2" um dos valores.',
    '',
    '## Caso de exemplo',
    '```json',
    JSON.stringify(t.sampleCase, null, 2),
    '```',
  ];
  return lines.filter((l) => l !== null).join('\n');
}

export function renderComponent(c: Component): string {
  return [
    `# ${c.name} (${c.type} v${c.version})`,
    '',
    c.description,
    '',
    `- Id: \`${c.id}\``,
    `- Status: ${c.status}`,
    c.domainId ? `- Domínio: ${c.domainId}` : null,
    `- Dono: ${c.owner}`,
    c.dependencies.length ? `- Dependências: ${c.dependencies.join(', ')}` : null,
    '',
    '## Conteúdo',
    '',
    c.content,
  ]
    .filter((l) => l !== null)
    .join('\n');
}

export function latestVersion(c: DataContract, version?: string): ContractVersion | undefined {
  if (version) return c.versions.find((v) => v.version === version);
  return [...c.versions].sort((a, b) => (a.publishedAt < b.publishedAt ? -1 : 1)).at(-1);
}

/** Contrato no estilo ODCS (YAML simplificado). */
export function renderContractYaml(c: DataContract, v: ContractVersion | undefined): string {
  const q = (s: string) => JSON.stringify(s);
  const out = [
    'apiVersion: v3.0.0',
    'kind: DataContract',
    `id: ${c.id}`,
    `name: ${q(c.name)}`,
    `domain: ${c.domainId}`,
    `entity: ${c.entity}`,
    `owner: ${q(c.owner)}`,
    `status: ${c.status}`,
  ];
  if (v) {
    out.push(
      `version: ${q(v.version)}`,
      `publishedAt: ${v.publishedAt}`,
      `author: ${q(v.author)}`,
      `note: ${q(v.note)}`,
      `sla:`,
      `  freshness: ${q(v.freshness)}`,
      `  expectedVolume: ${q(v.expectedVolume)}`,
      'schema:',
      `  - name: ${c.entity}`,
      '    properties:',
      ...v.fields.flatMap((f) => [
        `      - name: ${f.name}`,
        `        logicalType: ${f.type}`,
        `        required: ${f.required}`,
        `        classification: ${f.classification}`,
        `        description: ${q(f.description)}`,
        ...(f.ref ? [`        references: ${f.ref}`] : []),
      ]),
      'quality:',
      ...v.quality.flatMap((r) => [
        `  - id: ${r.id}`,
        `    type: ${r.kind}`,
        ...(r.field ? [`    field: ${r.field}`] : []),
        `    rule: ${q(r.expression)}`,
        `    lastResult: ${r.lastResult}`,
      ]),
    );
  }
  out.push(`versions: [${c.versions.map((x) => q(x.version)).join(', ')}]`);
  return out.join('\n');
}

export function renderArtifact(a: BrainArtifact, ws: WorkspaceData): string {
  const area = ws.brainAreas.find((x) => x.id === a.areaId);
  return [
    `# ${a.title}`,
    '',
    `- Id: \`${a.id}\``,
    `- Tipo: ${a.kind}`,
    area ? `- Área do cérebro: ${area.name} (${area.side})` : null,
    a.tags.length ? `- Tags: ${a.tags.join(', ')}` : null,
    a.componentId ? `- Componente: ${a.componentId}` : null,
    '',
    a.summary,
    '',
    a.body ?? '',
    ...(a.metrics?.length ? ['', '## Métricas', ...a.metrics.map((m) => `- ${m.label}: ${m.value}`)] : []),
  ]
    .filter((l) => l !== null)
    .join('\n');
}

export function renderDocument(d: KnowledgeDocument): string {
  return [`# ${d.title} (v${d.version})`, '', `- Id: \`${d.id}\``, `- Atualizado em: ${d.updatedAt}`, '', ...d.chunks.map((c, i) => `## Trecho ${i}\n\n${c}`)].join('\n');
}

export function renderPolicy(p: Policy): string {
  return [
    `# ${p.name}`,
    '',
    p.description,
    '',
    `- Id: \`${p.id}\``,
    `- Tipo: ${p.kind}`,
    `- Condição: ${p.condition}`,
    `- Efeito: ${p.effect}`,
    `- Ambientes: ${p.envs.join(', ')}`,
    '',
    '```json',
    p.code,
    '```',
  ].join('\n');
}

// ---------- catálogo de recursos por escopo ----------
function isTechArtifact(a: BrainArtifact, ws: WorkspaceData): boolean {
  const area = ws.brainAreas.find((x) => x.id === a.areaId);
  return area?.side === 'tecnico';
}
// Cuidado: "padrao" contém "adr"; exige a palavra inteira.
const isAdr = (a: BrainArtifact) => /(^|[^a-z])adrs?([^a-z]|$)/i.test(a.kind) || /^adr[-\s]/i.test(a.title);
const HOMOLOGADO = new Set(['homologado', 'publicado_prd']);

export function listResources(scope: Scope): ResourceEntry[] {
  const ws = wsOf(scope);
  const id = scope.workspaceId;
  const out: ResourceEntry[] = [];

  for (const t of ws.decisionTables) {
    out.push({ uri: uriOf(id, 'regras', t.id), kind: 'regras', id: t.id, name: `Regra: ${t.name}`, description: t.description, mimeType: 'text/markdown', render: () => renderDecisionTable(t) });
  }
  for (const c of ws.components.filter((c) => c.type === 'rule' && c.status !== 'depreciado')) {
    out.push({ uri: uriOf(id, 'regras', c.id), kind: 'regras', id: c.id, name: `Regra: ${c.name}`, description: c.description, mimeType: 'text/markdown', render: () => renderComponent(c) });
  }
  for (const a of ws.artifacts.filter((a) => isTechArtifact(a, ws))) {
    const kind: ResourceKind = isAdr(a) ? 'adrs' : 'padroes';
    out.push({ uri: uriOf(id, kind, a.id), kind, id: a.id, name: `${KIND_LABEL[kind]}: ${a.title}`, description: a.summary, mimeType: 'text/markdown', render: () => renderArtifact(a, ws) });
  }
  for (const c of ws.contracts.filter((c) => c.status !== 'rascunho')) {
    out.push({
      uri: uriOf(id, 'contratos', c.id), kind: 'contratos', id: c.id, name: `Contrato: ${c.name}`,
      description: `Contrato de dados da entidade ${c.entity} (${c.status})`, mimeType: 'application/yaml',
      render: () => renderContractYaml(c, latestVersion(c)),
    });
  }
  for (const d of ws.documents.filter((d) => d.status === 'processado')) {
    out.push({ uri: uriOf(id, 'documentos', d.id), kind: 'documentos', id: d.id, name: `Documento: ${d.title}`, description: d.chunks[0]?.slice(0, 160) ?? '', mimeType: 'text/markdown', render: () => renderDocument(d) });
  }
  for (const c of ws.components.filter((c) => c.type === 'documento' && HOMOLOGADO.has(c.status))) {
    out.push({ uri: uriOf(id, 'documentos', c.id), kind: 'documentos', id: c.id, name: `Documento: ${c.name}`, description: c.description, mimeType: 'text/markdown', render: () => renderComponent(c) });
  }
  for (const p of ws.policies.filter((p) => p.active && p.envs.includes(scope.env))) {
    out.push({ uri: uriOf(id, 'politicas', p.id), kind: 'politicas', id: p.id, name: `Política: ${p.name}`, description: p.description, mimeType: 'text/markdown', render: () => renderPolicy(p) });
  }
  return out;
}

export function registerResources(server: McpServer, scope: Scope, onRead: (uri: string, ok: boolean) => void) {
  const template = new ResourceTemplate('cortex://{workspaceId}/{kind}/{id}', {
    list: async () => ({
      resources: listResources(scope).map((r) => ({ uri: r.uri, name: r.name, description: r.description, mimeType: r.mimeType })),
    }),
    complete: {
      kind: () => [...RESOURCE_KINDS],
    },
  });

  server.registerResource(
    'cerebro-do-projeto',
    template,
    {
      title: 'Cérebro do projeto',
      description:
        'Regras de negócio (tabelas de decisão), padrões técnicos, ADRs, contratos de dados (ODCS), documentos homologados e políticas do workspace do token.',
    },
    async (uri, vars) => {
      const wsId = String(vars.workspaceId);
      if (wsId !== scope.workspaceId) {
        onRead(uri.href, false);
        throw new Error(`O token dá acesso apenas ao workspace "${scope.workspaceId}".`);
      }
      const kind = String(vars.kind);
      const id = decodeURIComponent(String(vars.id));
      const entry = listResources(scope).find((r) => r.kind === kind && r.id === id);
      if (!entry) {
        onRead(uri.href, false);
        throw new Error(`Recurso não encontrado: ${uri.href}`);
      }
      onRead(uri.href, true);
      return { contents: [{ uri: uri.href, mimeType: entry.mimeType, text: entry.render() }] };
    },
  );

  // Índice estático: útil para clientes que não listam templates.
  server.registerResource(
    'indice',
    `cortex://${scope.workspaceId}/indice`,
    { title: 'Índice do cérebro', description: 'Lista de todos os recursos do projeto, agrupados por tipo.', mimeType: 'text/markdown' },
    async (uri) => {
      onRead(uri.href, true);
      const entries = listResources(scope);
      const ws = store.get(scope.workspaceId);
      const lines = [`# Cérebro de ${ws?.workspace.company ?? scope.workspaceId} (${scope.env})`, ''];
      if (entries.length === 0) lines.push('_Nenhum recurso disponível ainda: o seed deste workspace está vazio._');
      for (const k of RESOURCE_KINDS) {
        const list = entries.filter((e) => e.kind === k);
        if (!list.length) continue;
        lines.push(`## ${KIND_LABEL[k]} (${list.length})`, '', ...list.map((e) => `- [${e.name}](${e.uri})`), '');
      }
      return { contents: [{ uri: uri.href, mimeType: 'text/markdown', text: lines.join('\n') }] };
    },
  );
}
