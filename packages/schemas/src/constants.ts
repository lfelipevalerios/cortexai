import type { EnvId, IndustryId, NodeCategory, ProfileId, ComponentType, ConnectorCategory } from './model';

export const INDUSTRIES: Record<IndustryId, { label: string }> = {
  saude: { label: 'Saúde' },
  varejo: { label: 'Varejo' },
  financeiro: { label: 'Financeiro' },
  telecom: { label: 'Telecom' },
};

export const ENVS: Record<EnvId, { label: string; color: string; purpose: string }> = {
  dev: { label: 'Dev', color: '#A07EFC', purpose: 'Criar e testar com dados sintéticos e sandboxes' },
  hml: { label: 'Hml', color: '#F9D718', purpose: 'Homologar com o negócio sobre dados mascarados' },
  prd: { label: 'Prd', color: '#00FF95', purpose: 'Operar com clientes reais' },
};
export const ENV_ORDER: EnvId[] = ['dev', 'hml', 'prd'];

export type ModuleId =
  | 'cockpit' | 'iniciativas' | 'cerebro' | 'catalogo' | 'jornadas' | 'ambientes'
  | 'conectores' | 'dados' | 'conhecimento' | 'canais' | 'ides'
  | 'governanca' | 'telemetria';

export const PROFILES: Record<ProfileId, { label: string; who: string; modules: ModuleId[] | 'all'; does: string }> = {
  patrocinador: { label: 'Patrocinador executivo', who: 'Diretoria', modules: ['cockpit', 'iniciativas', 'telemetria'], does: 'Decide go/no-go de iniciativas' },
  dono_negocio: { label: 'Dono de negócio', who: 'PO ou gestor da área', modules: ['cockpit', 'cerebro', 'iniciativas', 'jornadas', 'ambientes'], does: 'Cria iniciativas, edita regras do domínio, aprova ida para Prd' },
  champion: { label: 'Champion AI', who: 'Responsável pela visão funcional e técnica', modules: 'all', does: 'Compõe pacotes, cria jornadas, promove para Hml' },
  engenheiro_ai: { label: 'Engenheiro AI', who: 'Desenvolvedor', modules: ['catalogo', 'jornadas', 'cerebro', 'ides', 'ambientes'], does: 'Usa componentes, conecta a IDE, edita jornadas em Dev' },
  engenheiro_dados: { label: 'Engenheiro de dados', who: 'Time de dados', modules: ['conectores', 'dados', 'conhecimento'], does: 'Cadastra conectores, publica contratos e produtos de dados' },
  coe: { label: 'CoE AI', who: 'Centro de excelência', modules: ['catalogo', 'governanca', 'telemetria', 'ambientes', 'cockpit'], does: 'Homologa componentes, define políticas, aprova releases' },
  seguranca: { label: 'Segurança e compliance', who: 'Segurança da informação, DPO', modules: ['governanca', 'conectores'], does: 'Define políticas de dado e de modelo, audita' },
  admin: { label: 'Administrador', who: 'TI do cliente', modules: [], does: 'Gerencia usuários, workspaces e integrações de login' },
};

/** Ações sensíveis e quem pode executá-las. Combina perfil, domínio e ambiente. */
export type PermissionAction =
  | 'editar_jornada' | 'promover_hml' | 'aprovar_prd' | 'homologar_componente'
  | 'editar_regra' | 'publicar_contrato' | 'cadastrar_conector' | 'editar_politica'
  | 'decidir_iniciativa' | 'criar_iniciativa';

export const PERMISSIONS: Record<PermissionAction, { profiles: ProfileId[]; envs?: EnvId[]; label: string }> = {
  editar_jornada: { profiles: ['champion', 'engenheiro_ai'], envs: ['dev'], label: 'Editar jornadas' },
  promover_hml: { profiles: ['champion'], label: 'Promover para Hml' },
  aprovar_prd: { profiles: ['coe', 'dono_negocio'], label: 'Aprovar ida para Prd' },
  homologar_componente: { profiles: ['coe'], label: 'Homologar componentes' },
  editar_regra: { profiles: ['dono_negocio', 'champion'], label: 'Editar regras de negócio' },
  publicar_contrato: { profiles: ['engenheiro_dados', 'champion'], label: 'Publicar contratos de dados' },
  cadastrar_conector: { profiles: ['engenheiro_dados', 'champion'], label: 'Cadastrar conectores' },
  editar_politica: { profiles: ['coe', 'seguranca'], label: 'Editar políticas' },
  decidir_iniciativa: { profiles: ['patrocinador'], label: 'Decidir go/no-go' },
  criar_iniciativa: { profiles: ['dono_negocio', 'champion'], label: 'Criar iniciativas' },
};

export function can(profile: ProfileId, action: PermissionAction, env?: EnvId): boolean {
  const p = PERMISSIONS[action];
  if (!p.profiles.includes(profile)) return false;
  // O Champion AI vê tudo, mas edição de jornada segue a regra de ambiente.
  if (p.envs && env && !p.envs.includes(env)) return false;
  return true;
}

export function profilesThatCan(action: PermissionAction): ProfileId[] {
  return PERMISSIONS[action].profiles;
}

export const NODE_CATEGORIES: Record<NodeCategory, { label: string; color: string }> = {
  gatilho: { label: 'Gatilhos', color: '#00FF95' },
  agente: { label: 'Agentes', color: '#A07EFC' },
  conhecimento: { label: 'Conhecimento', color: '#CFC4F2' },
  dados: { label: 'Dados e integrações', color: '#66FFBF' },
  logica: { label: 'Lógica', color: '#A99FB8' },
  pessoas: { label: 'Pessoas', color: '#F9D718' },
  guardrail: { label: 'Guardrails', color: '#FF7A9A' },
  saida: { label: 'Saídas', color: '#FFFFFF' },
};

export interface NodeKindDef {
  kind: string;
  category: NodeCategory;
  label: string;
  icon: string;
  outputs?: string[];
}

/** Paleta do Studio (seção 7). Ícones são nomes Lucide. */
export const NODE_KINDS: NodeKindDef[] = [
  { kind: 'gatilho.mensagem', category: 'gatilho', label: 'Mensagem de canal', icon: 'MessageCircle' },
  { kind: 'gatilho.evento', category: 'gatilho', label: 'Evento', icon: 'Zap' },
  { kind: 'gatilho.agendamento', category: 'gatilho', label: 'Agendamento', icon: 'CalendarClock' },
  { kind: 'gatilho.api', category: 'gatilho', label: 'Chamada de API', icon: 'Webhook' },
  { kind: 'gatilho.dado', category: 'gatilho', label: 'Mudança de dado', icon: 'DatabaseZap' },
  { kind: 'agente.agente', category: 'agente', label: 'Agente', icon: 'Bot' },
  { kind: 'agente.intencao', category: 'agente', label: 'Classificar intenção', icon: 'Tags' },
  { kind: 'agente.extrair', category: 'agente', label: 'Extrair dados', icon: 'ScanText' },
  { kind: 'agente.resumir', category: 'agente', label: 'Resumir', icon: 'AlignLeft' },
  { kind: 'conhecimento.buscar', category: 'conhecimento', label: 'Buscar na base', icon: 'BookOpen' },
  { kind: 'conhecimento.regra', category: 'conhecimento', label: 'Consultar regra do cérebro', icon: 'Scale' },
  { kind: 'dados.produto', category: 'dados', label: 'Ler produto de dados', icon: 'Database' },
  { kind: 'dados.tool', category: 'dados', label: 'Executar ação em sistema', icon: 'Wrench' },
  { kind: 'dados.http', category: 'dados', label: 'Chamada HTTP', icon: 'Globe' },
  { kind: 'dados.mcp', category: 'dados', label: 'Tool MCP', icon: 'Plug' },
  { kind: 'logica.condicao', category: 'logica', label: 'Condição', icon: 'GitBranch', outputs: ['sim', 'não'] },
  { kind: 'logica.tabela', category: 'logica', label: 'Tabela de decisão', icon: 'Table' },
  { kind: 'logica.dividir', category: 'logica', label: 'Dividir caminhos', icon: 'Split' },
  { kind: 'logica.paralelo', category: 'logica', label: 'Paralelo', icon: 'Columns2' },
  { kind: 'logica.repetir', category: 'logica', label: 'Repetir', icon: 'Repeat' },
  { kind: 'logica.esperar', category: 'logica', label: 'Esperar', icon: 'Timer' },
  { kind: 'logica.transformar', category: 'logica', label: 'Transformar', icon: 'Shuffle' },
  { kind: 'pessoas.aprovacao', category: 'pessoas', label: 'Aprovação humana', icon: 'UserCheck', outputs: ['aprovado', 'reprovado'] },
  { kind: 'pessoas.transbordo', category: 'pessoas', label: 'Transbordo para atendente', icon: 'Headset' },
  { kind: 'pessoas.tarefa', category: 'pessoas', label: 'Criar tarefa', icon: 'ListTodo' },
  { kind: 'guardrail.pii', category: 'guardrail', label: 'Filtro de PII', icon: 'ShieldCheck' },
  { kind: 'guardrail.conteudo', category: 'guardrail', label: 'Política de conteúdo', icon: 'ShieldAlert' },
  { kind: 'guardrail.custo', category: 'guardrail', label: 'Limite de custo', icon: 'Gauge' },
  { kind: 'guardrail.fonte', category: 'guardrail', label: 'Verificação de fonte', icon: 'BadgeCheck' },
  { kind: 'saida.responder', category: 'saida', label: 'Responder no canal', icon: 'Send' },
  { kind: 'saida.notificar', category: 'saida', label: 'Notificar', icon: 'Bell' },
  { kind: 'saida.itsm', category: 'saida', label: 'Registrar no ITSM', icon: 'Ticket' },
  { kind: 'saida.encerrar', category: 'saida', label: 'Encerrar', icon: 'CircleStop' },
];

export const COMPONENT_TYPES: Record<ComponentType, { label: string; description: string }> = {
  skill: { label: 'Skill', description: 'Capacidade reutilizável com instruções e exemplos' },
  agent: { label: 'Agent', description: 'Agente com papel, skills, regras e tools definidos' },
  rule: { label: 'Rule', description: 'Regra ou guardrail que restringe comportamento' },
  mcp: { label: 'MCP', description: 'Servidor de ferramentas, interno ou externo' },
  hook: { label: 'Hook', description: 'Ação disparada antes ou depois de um evento' },
  documento: { label: 'Documento', description: 'Conhecimento de referência versionado' },
  pacote: { label: 'Pacote', description: 'Composição de componentes homologados' },
};

export const CONNECTOR_CATEGORIES: Record<ConnectorCategory, string> = {
  crm: 'CRM',
  erp: 'ERP',
  banco: 'Bancos de dados',
  plataforma_dados: 'Plataformas de dados',
  api: 'APIs',
  eventos: 'Eventos',
  arquivos: 'Arquivos e documentos',
  itsm: 'ITSM e engenharia',
  mcp: 'MCP externos',
  setorial: 'Setoriais',
};

export const INITIATIVE_STAGES = [
  { id: 'ideia', label: 'Ideia' },
  { id: 'validacao', label: 'Validação' },
  { id: 'prototipo', label: 'Protótipo' },
  { id: 'construcao', label: 'Construção' },
  { id: 'operacao', label: 'Operação' },
] as const;
