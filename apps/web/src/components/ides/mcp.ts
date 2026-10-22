import { Braces, Code2, SquareTerminal, Terminal, type LucideIcon } from 'lucide-react';
import type { BuildOrder, EnvId, IdeId, WorkspaceData } from '@cortex/schemas';
import { ENVS, COMPONENT_TYPES } from '@cortex/schemas';

export const IDES: Record<IdeId, { label: string; icon: LucideIcon; configFile: string }> = {
  claude_code: { label: 'Claude Code', icon: Terminal, configFile: 'terminal' },
  cursor: { label: 'Cursor', icon: Code2, configFile: '.cursor/mcp.json' },
  vscode_copilot: { label: 'VS Code com Copilot', icon: SquareTerminal, configFile: '.vscode/mcp.json' },
  jetbrains: { label: 'JetBrains', icon: Braces, configFile: 'AI Assistant · MCP' },
};

export const IDE_ORDER: IdeId[] = ['claude_code', 'cursor', 'vscode_copilot', 'jetbrains'];

/** Ferramentas do servidor MCP real (apps/mcp-server/src/tools.ts). */
export const MCP_READ_TOOLS: { name: string; title: string }[] = [
  { name: 'obter_ordem', title: 'Obter ordem de construção (pacote completo da OC)' },
  { name: 'buscar_regra', title: 'Buscar regra de negócio' },
  { name: 'obter_contrato', title: 'Obter contrato de dados (ODCS)' },
  { name: 'listar_componentes', title: 'Listar componentes do catálogo' },
  { name: 'consultar_conhecimento', title: 'Consultar base de conhecimento, com fonte' },
  { name: 'validar_contra_padroes', title: 'Validar contra os padrões (devolve a regra de origem)' },
  { name: 'obter_iniciativa', title: 'Obter iniciativa (extra)' },
  { name: 'obter_telemetria', title: 'Obter telemetria do MCP (extra)' },
];

export const MCP_WRITE_TOOLS: { name: string; title: string }[] = [
  { name: 'registrar_plano', title: 'Registrar plano da OC' },
  { name: 'registrar_progresso', title: 'Registrar progresso por nó' },
  { name: 'registrar_evidencia', title: 'Registrar evidência (testes, PR)' },
  { name: 'propor_mudanca', title: 'Propor mudança no desenho' },
  { name: 'salvar_rascunho_jornada', title: 'Salvar rascunho de jornada (só em Dev)' },
  { name: 'registrar_validacao', title: 'Registrar validação da iniciativa' },
  { name: 'criar_historia_itsm', title: 'Criar história no ITSM' },
];

export const MCP_ALL_TOOLS = [...MCP_READ_TOOLS, ...MCP_WRITE_TOOLS].map((t) => t.name);
export const WRITE_SET = new Set(MCP_WRITE_TOOLS.map((t) => t.name));

export const MCP_RESOURCES: { kind: string; what: string; format: string }[] = [
  { kind: 'regras', what: 'Tabelas de decisão e componentes Rule', format: 'Markdown' },
  { kind: 'padroes', what: 'Padrões das áreas técnicas do cérebro', format: 'Markdown' },
  { kind: 'adrs', what: 'Decisões de arquitetura', format: 'Markdown' },
  { kind: 'contratos', what: 'Contratos de dados publicados', format: 'YAML (ODCS)' },
  { kind: 'documentos', what: 'Documentos homologados, em trechos', format: 'Markdown' },
  { kind: 'politicas', what: 'Políticas ativas no ambiente do token', format: 'Markdown + JSON' },
  { kind: 'negocio', what: 'OKRs, mercado, regulação e produtos', format: 'Markdown' },
];

export const MCP_PROMPTS: { name: string; title: string; args: string[] }[] = [
  { name: 'implementar_historia', title: 'Implementar história seguindo os padrões do projeto', args: ['historia', 'ordemId'] },
  { name: 'revisar_codigo', title: 'Revisar código contra as regras', args: ['codigo', 'caminhoArquivo'] },
];

export const MCP_URLS = [
  { value: 'http://localhost:8787/mcp', label: 'Servidor local do protótipo (pnpm mcp)' },
  { value: 'https://cortex.exemplo.com/mcp', label: 'Servidor hospedado (exemplo)' },
];

function hash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36).padStart(7, '0').slice(0, 7);
}

export function slug(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'projeto';
}

/** Token pessoal no formato aceito pelo servidor real: ctx_<workspaceId>_<env>_<projeto>. */
export function makeToken(workspaceId: string, env: EnvId, project: string, ide: IdeId, userId: string): string {
  return `ctx_${workspaceId}_${env}_${slug(project)}-${hash(`${ide}|${project}|${env}|${userId}`)}`;
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate.slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function brDate(isoDate: string): string {
  const [y, m, d] = isoDate.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export function ideConfig(ide: IdeId, url: string, token: string): { title: string; code: string; note: string }[] {
  const json = (root: 'mcpServers' | 'servers') =>
    JSON.stringify(
      {
        [root]: {
          cortex: {
            ...(root === 'servers' ? { type: 'http' } : {}),
            url,
            headers: { Authorization: `Bearer ${token}` },
          },
        },
      },
      null,
      2,
    );
  switch (ide) {
    case 'claude_code':
      return [
        {
          title: 'Terminal',
          code: `claude mcp add --transport http cortex ${url} --header "Authorization: Bearer ${token}"\n\n# conferir\nclaude mcp list`,
          note: 'Use --scope project para gravar em .mcp.json no repositório. Dentro da sessão, /mcp mostra o servidor conectado.',
        },
        {
          title: 'Sem gravar o token (variável de ambiente)',
          code: `export CORTEX_TOKEN=${token}\nclaude mcp add --transport http cortex ${url} --header "Authorization: Bearer \${CORTEX_TOKEN}"`,
          note: 'A variável é expandida quando a configuração carrega.',
        },
      ];
    case 'cursor':
      return [{ title: '.cursor/mcp.json (projeto) ou ~/.cursor/mcp.json', code: json('mcpServers'), note: 'O Cursor recarrega o servidor ao salvar o arquivo.' }];
    case 'vscode_copilot':
      return [{ title: '.vscode/mcp.json', code: json('servers'), note: 'No modo agente do Copilot, as ferramentas do Córtex aparecem na lista de ferramentas.' }];
    case 'jetbrains':
      return [
        {
          title: 'Settings › Tools › AI Assistant › Model Context Protocol (MCP) › Add › JSON',
          code: json('mcpServers'),
          note: 'Formato ilustrativo: conferir contra a versão vigente do AI Assistant na construção.',
        },
      ];
  }
}

export const PLUGIN_COMMANDS = {
  session: '/plugin marketplace add ./plugin\n/plugin install cortex@cortex-marketplace',
  terminal: 'claude plugin marketplace add ./plugin\nclaude plugin install cortex@cortex-marketplace',
  env: (url: string, token: string) =>
    `# bash/zsh\nexport CORTEX_MCP_URL=${url}\nexport CORTEX_TOKEN=${token}\n\n# PowerShell\n$env:CORTEX_MCP_URL = "${url}"\n$env:CORTEX_TOKEN = "${token}"`,
};

export const OC_STATUS: Record<BuildOrder['status'], { status: string; label: string }> = {
  na_fila: { status: 'pendente', label: 'Na fila' },
  plano_registrado: { status: 'em_revisao', label: 'Plano registrado' },
  em_construcao: { status: 'sincronizando', label: 'Em construção' },
  pronta_revisao: { status: 'homologado', label: 'Pronta para revisão' },
  concluida: { status: 'aprovado', label: 'Concluída' },
};

// ---------- Exportar contexto como arquivos ----------
function brainParts(ws: WorkspaceData, env: EnvId) {
  const tecnicoAreas = new Set(ws.brainAreas.filter((a) => a.side === 'tecnico').map((a) => a.id));
  const standards = ws.artifacts.filter((a) => tecnicoAreas.has(a.areaId)).slice(0, 10);
  const rules = ws.decisionTables;
  const contracts = ws.contracts.filter((c) => c.status !== 'rascunho' || c.versions.length > 0);
  const policies = ws.policies.filter((p) => p.active && p.envs.includes(env));
  const components = ws.components.filter((c) => c.status === 'homologado' || c.status === 'publicado_prd').slice(0, 12);
  return { standards, rules, contracts, policies, components };
}

const EFFECT: Record<string, string> = { bloquear: 'bloqueia', exigir_aprovacao: 'exige aprovação', alertar: 'alerta' };

export function exportClaudeMd(ws: WorkspaceData, env: EnvId, today: string): string {
  const { standards, rules, contracts, policies, components } = brainParts(ws, env);
  const wid = ws.workspace.id;
  return [
    `# CLAUDE.md · ${ws.workspace.company}`,
    '',
    `> Gerado pelo Córtex a partir do cérebro do projeto em ${brDate(today)} (ambiente ${ENVS[env].label}).`,
    '> Não edite à mão: as regras vivem no Córtex e também chegam pelo servidor MCP `cortex`.',
    '',
    '## Projeto',
    ws.workspace.description,
    '',
    '## Como trabalhar neste repositório',
    '- Leia a ordem de construção com `obter_ordem` antes de implementar e registre o plano com `registrar_plano`.',
    '- Rode `validar_contra_padroes` a cada etapa; violação bloqueante não vai para o PR.',
    '- Registre `registrar_progresso` a cada nó concluído e `registrar_evidencia` com testes e link do PR.',
    '- Nunca altere contrato, regra ou jornada por conta própria: use `propor_mudanca`.',
    '- Dados pessoais (CPF, e-mail, telefone) nunca vão para log ou resposta sem máscara.',
    '',
    '## Regras de negócio',
    ...rules.map((r) => `- **${r.name}** v${r.version}: ${r.description}${r.source ? ` (origem: ${r.source})` : ''}. Recurso: \`cortex://${wid}/regras/${r.id}\``),
    '',
    '## Padrões técnicos e ADRs',
    ...standards.map((a) => `- **${a.title}** (${a.kind}): ${a.summary}`),
    '',
    '## Contratos de dados',
    ...contracts.map((c) => {
      const v = c.versions[c.versions.length - 1];
      const pii = v?.fields.filter((f) => f.classification === 'pii').map((f) => f.name) ?? [];
      return `- **${c.name}** (${c.entity}) v${v?.version ?? '—'}${pii.length ? `: campos PII ${pii.join(', ')}; mascarar antes de log ou resposta` : ''}`;
    }),
    '',
    `## Políticas ativas em ${ENVS[env].label}`,
    ...policies.map((p) => `- **${p.name}** (${EFFECT[p.effect] ?? p.effect}): ${p.condition}`),
    '',
    '## Componentes homologados para reuso',
    ...components.map((c) => `- ${c.name} · ${COMPONENT_TYPES[c.type].label} ${c.version}`),
    '',
  ].join('\n');
}

export function exportAgentsMd(ws: WorkspaceData, env: EnvId, today: string): string {
  const { rules, contracts, policies } = brainParts(ws, env);
  return [
    '# AGENTS.md',
    '',
    `Contexto para agentes de código no projeto da ${ws.workspace.company}. Gerado pelo Córtex em ${brDate(today)} (${ENVS[env].label}).`,
    '',
    '## Fonte da verdade',
    `O cérebro do projeto fica no Córtex e é servido pelo MCP \`cortex\` (recursos \`cortex://${ws.workspace.id}/indice\`). Em caso de dúvida, consulte o MCP em vez de supor.`,
    '',
    '## Ferramentas MCP',
    `- Leitura: ${MCP_READ_TOOLS.map((t) => `\`${t.name}\``).join(', ')}`,
    `- Escrita: ${MCP_WRITE_TOOLS.map((t) => `\`${t.name}\``).join(', ')}`,
    '',
    '## Regras que o código precisa respeitar',
    ...rules.map((r) => `- ${r.name} v${r.version}`),
    ...policies.map((p) => `- Política: ${p.name} (${EFFECT[p.effect] ?? p.effect})`),
    '',
    '## Dados',
    ...contracts.map((c) => `- ${c.entity}: contrato ${c.name} v${c.versions[c.versions.length - 1]?.version ?? '—'}`),
    '',
    '## Definição de pronto',
    '- Testes gerados dos casos do Studio passando.',
    '- `validar_contra_padroes` sem violações bloqueantes.',
    '- PR aberto com evidências registradas na OC.',
    '',
  ].join('\n');
}

export function exportCursorRules(ws: WorkspaceData, env: EnvId): string {
  const { rules, contracts, policies } = brainParts(ws, env);
  const pii = contracts.flatMap((c) => c.versions[c.versions.length - 1]?.fields.filter((f) => f.classification === 'pii').map((f) => f.name) ?? []);
  return [
    '---',
    `description: Regras do projeto ${ws.workspace.company} geradas pelo Córtex (${ENVS[env].label})`,
    'globs:',
    'alwaysApply: true',
    '---',
    '',
    '- Antes de criar algo novo, use `listar_componentes` do MCP cortex para reutilizar o que já está homologado.',
    '- Rode `validar_contra_padroes` antes de concluir cada etapa.',
    `- Nunca registre em log nem devolva sem máscara: ${[...new Set(pii)].slice(0, 12).join(', ') || 'CPF, e-mail, telefone'}.`,
    ...rules.map((r) => `- Regra de negócio "${r.name}" v${r.version}: consulte com \`buscar_regra\`; não reimplemente de memória.`),
    ...policies.map((p) => `- ${p.name}: ${p.condition} (${EFFECT[p.effect] ?? p.effect}).`),
    '- Mudanças em contrato, regra ou jornada passam por `propor_mudanca`.',
    '',
  ].join('\n');
}
