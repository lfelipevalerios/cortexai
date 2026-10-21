// Modelo de dados do Córtex (seção 16 do plano). Fonte única do contrato:
// a aplicação web, o mock, o servidor MCP e o futuro backend usam estes tipos.

// ---------- Organização ----------
export type IndustryId = 'saude' | 'varejo' | 'financeiro' | 'telecom';
export type EnvId = 'dev' | 'hml' | 'prd';
export type ProfileId =
  | 'patrocinador'
  | 'dono_negocio'
  | 'champion'
  | 'engenheiro_ai'
  | 'engenheiro_dados'
  | 'coe'
  | 'seguranca'
  | 'admin';

export interface Workspace {
  id: string;
  industry: IndustryId;
  company: string;
  segment: string;
  tagline: string;
  description: string;
}

export interface User {
  id: string;
  name: string;
  profile: ProfileId;
  domainIds: string[];
}

// ---------- Conectar ----------
export type ConnectorCategory =
  | 'crm' | 'erp' | 'banco' | 'plataforma_dados' | 'api' | 'eventos'
  | 'arquivos' | 'itsm' | 'mcp' | 'setorial';
export type AuthMethod = 'oauth2' | 'api_key' | 'usuario_senha' | 'certificado';
export type ConnectorStatus = 'rascunho' | 'conectado' | 'sincronizando' | 'degradado' | 'erro' | 'pausado';
export type SyncMode = 'cdc' | 'agendado' | 'sob_demanda';

/** Item da galeria de conectores. */
export interface ConnectorType {
  id: string;
  name: string;
  category: ConnectorCategory;
  auth: AuthMethod;
  badge: 'Nativo' | 'OpenAPI' | 'MCP';
  /** Conector real no protótipo (PostgreSQL e REST/OpenAPI). */
  real?: boolean;
  industry?: IndustryId;
  description: string;
}

export interface DiscoveredField {
  name: string;
  type: string;
  pii?: boolean;
}

export interface DiscoveredObject {
  name: string;
  kind: 'tabela' | 'objeto' | 'endpoint';
  records: number;
  fields: DiscoveredField[];
  sample: Record<string, string | number | boolean | null>[];
}

export interface ConnectorTool {
  id: string;
  name: string;
  description: string;
  mode: 'leitura' | 'escrita';
  /** Tool de escrita nasce desligada em Prd (regra do módulo). */
  enabledByEnv: Record<EnvId, boolean>;
  policyId?: string;
}

export interface ConnectorCredential {
  endpoint: string;
  /** Referência ao segredo no cofre; nunca o valor. */
  secretRef: string;
}

export interface ConnectorLog {
  at: string;
  level: 'info' | 'aviso' | 'erro';
  message: string;
}

export interface Connector {
  id: string;
  typeId: string;
  name: string;
  status: ConnectorStatus;
  envs: Partial<Record<EnvId, ConnectorCredential>>;
  domainId?: string;
  syncMode: SyncMode;
  lastSync: string;
  volume: number;
  latencyMs: number;
  /** Ids de jornadas, contratos ou canais que consomem o conector. */
  consumers: string[];
  objects: DiscoveredObject[];
  tools: ConnectorTool[];
  logs: ConnectorLog[];
}

/** Sistema do mapa do ecossistema (capítulo "As ilhas"). */
export interface EcosystemSystem {
  id: string;
  name: string;
  category: ConnectorCategory | 'canal';
  connectorId?: string;
}

export type ChannelType =
  | 'webchat' | 'app' | 'whatsapp' | 'email' | 'voz' | 'backoffice' | 'teams' | 'api' | 'agentes';

export interface Channel {
  id: string;
  type: ChannelType;
  name: string;
  status: 'ativo' | 'rascunho' | 'pausado';
  config: Record<string, string>;
  journeyByEnv: Partial<Record<EnvId, string>>;
}

export type IdeId = 'claude_code' | 'cursor' | 'vscode_copilot' | 'jetbrains';

export interface IdeConnection {
  id: string;
  ide: IdeId;
  userId: string;
  project: string;
  env: EnvId;
  connectedAt: string;
  lastCallAt: string;
  tools: string[];
}

// ---------- Dados e conhecimento ----------
export type DataClassification = 'pii' | 'sensivel' | 'interno' | 'publico';

export interface DataDomain {
  id: string;
  name: string;
  kind: 'negocio' | 'tecnico';
  owner: string;
  description: string;
  entities: string[];
  /** Ids de outros domínios relacionados. */
  relations: string[];
  products: string[];
  consumers: string[];
  position: { x: number; y: number };
}

export interface ContractField {
  name: string;
  type: string;
  required: boolean;
  classification: DataClassification;
  description: string;
  /** Referência a outra entidade, ex.: "Cliente.id". */
  ref?: string;
}

export interface QualityRule {
  id: string;
  kind: 'completude' | 'unicidade' | 'faixa' | 'frescor' | 'volume';
  field?: string;
  expression: string;
  lastResult: 'ok' | 'falha';
  /** Percentual de sucesso nas últimas execuções, mais antiga primeiro. */
  history: number[];
}

export interface ContractVersion {
  version: string;
  publishedAt: string;
  author: string;
  note: string;
  fields: ContractField[];
  quality: QualityRule[];
  freshness: string;
  expectedVolume: string;
}

export interface DataContract {
  id: string;
  name: string;
  domainId: string;
  entity: string;
  owner: string;
  status: 'rascunho' | 'publicado' | 'depreciado';
  versions: ContractVersion[];
}

export interface LakeColumn {
  name: string;
  type: string;
  nullsPct: number;
  distinct: number;
  pii?: boolean;
}

export interface LakeTable {
  id: string;
  name: string;
  layer: 'bronze' | 'prata' | 'ouro';
  domainId: string;
  rows: number;
  updatedAt: string;
  columns: LakeColumn[];
  sample: Record<string, string | number | boolean | null>[];
}

export interface SqlExample {
  id: string;
  question: string;
  sql: string;
  columns: string[];
  rows: (string | number)[][];
}

export interface LineageNode {
  id: string;
  label: string;
  kind: 'conector' | 'bronze' | 'prata' | 'ouro' | 'contrato' | 'jornada' | 'canal';
  refId?: string;
}

export interface Lineage {
  nodes: LineageNode[];
  edges: { source: string; target: string }[];
}

export interface KnowledgeCollection {
  id: string;
  name: string;
  theme: string;
  owner: string;
  domainId?: string;
  profiles: ProfileId[];
  chunking: string;
  embeddingModel: string;
}

export interface KnowledgeDocument {
  id: string;
  collectionId: string;
  title: string;
  version: string;
  updatedAt: string;
  status: 'processado' | 'processando' | 'erro';
  /** Texto escrito para a demo, dividido em trechos. */
  chunks: string[];
}

export interface RetrievalExample {
  question: string;
  answer: string;
  results: { docId: string; chunkIndex: number; score: number }[];
}

export interface KnowledgeGraph {
  nodes: { id: string; label: string; kind: 'entidade' | 'tabela' | 'documento' | 'regra' }[];
  edges: { source: string; target: string; label?: string }[];
}

// ---------- Cérebro ----------
export type BrainSide = 'negocio' | 'tecnico';

export interface BrainArea {
  id: string;
  side: BrainSide;
  name: string;
  description: string;
  owner: string;
  updatedAt: string;
  /** 0 a 100: percentual dos domínios com conteúdo homologado. */
  coverage: number;
}

/** Item genérico do cérebro: objetivo, ficha de mercado, ADR, padrão etc. */
export interface BrainArtifact {
  id: string;
  areaId: string;
  kind: string;
  title: string;
  summary: string;
  body?: string;
  tags: string[];
  metrics?: { label: string; value: string }[];
  componentId?: string;
}

export interface RadarItem {
  name: string;
  quadrant: 'tecnicas' | 'plataformas' | 'ferramentas' | 'linguagens';
  ring: 'adotar' | 'experimentar' | 'avaliar' | 'evitar';
}

export interface DecisionInput {
  key: string;
  label: string;
  type: 'number' | 'string' | 'boolean' | 'enum';
  options?: string[];
}

/**
 * Condição por célula: "*" (qualquer), "=valor", "!=valor", ">=n", "<=n", ">n", "<n",
 * "a..b" (faixa numérica inclusiva) ou "v1|v2" (um dos valores).
 */
export interface DecisionRow {
  id: string;
  conditions: Record<string, string>;
  outputs: Record<string, string>;
  note?: string;
}

export interface DecisionTable {
  id: string;
  name: string;
  domainId: string;
  description: string;
  version: string;
  /** Regulação ou documento que origina a regra. */
  source?: string;
  inputs: DecisionInput[];
  outputs: { key: string; label: string }[];
  rows: DecisionRow[];
  sampleCase: Record<string, string | number | boolean>;
  componentId?: string;
}

export type ComponentType = 'skill' | 'agent' | 'rule' | 'mcp' | 'hook' | 'documento' | 'pacote';
export type ComponentStatus = 'rascunho' | 'em_revisao' | 'homologado' | 'publicado_prd' | 'depreciado';

export interface Component {
  id: string;
  type: ComponentType;
  name: string;
  version: string;
  status: ComponentStatus;
  domainId?: string;
  owner: string;
  consumers: number;
  rating: number;
  description: string;
  /** Instruções, definição da regra ou código. */
  content: string;
  inputs: string[];
  outputs: string[];
  dependencies: string[];
  changelog: { version: string; date: string; note: string }[];
  evaluation: { score: number; cases: number; passed: number };
  approvals: { at: string; by: string; profile: ProfileId; decision: 'aprovado' | 'reprovado'; note?: string }[];
  /** Para pacotes: Jornada (curta) ou Esteira (durável). */
  packageKind?: 'jornada' | 'esteira';
}

// ---------- Construir ----------
export type NodeCategory =
  | 'gatilho' | 'agente' | 'conhecimento' | 'dados' | 'logica' | 'pessoas' | 'guardrail' | 'saida';

export interface JourneyNode {
  id: string;
  /** Tipo do nó, ex.: "gatilho.mensagem", "agente.agente", "guardrail.pii". */
  kind: string;
  category: NodeCategory;
  label: string;
  position: { x: number; y: number };
  componentId?: string;
  componentVersion?: string;
  ruleId?: string;
  contractId?: string;
  toolId?: string;
  channelId?: string;
  /** Saídas nomeadas em nós de decisão, ex.: ["sim", "não"]. */
  outputs?: string[];
  /** O nó produz dado pessoal na saída. */
  emitsPii?: boolean;
  config?: Record<string, string>;
}

export interface JourneyEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  label?: string;
}

export interface JourneyGraph {
  nodes: JourneyNode[];
  edges: JourneyEdge[];
}

export interface JourneyVersion {
  version: string;
  createdAt: string;
  author: string;
  note: string;
  graph: JourneyGraph;
}

/** Saída roteirizada de um nó no modo demonstração. */
export interface StepScript {
  input: string;
  output: string;
  rule?: string;
  source?: string;
  tokens: number;
  latencyMs: number;
  costBRL: number;
  /** Caminho escolhido em nós de decisão. */
  takeHandle?: string;
}

export interface JourneyTestCase {
  id: string;
  name: string;
  input: string;
  expected: string;
  lastResult?: 'passou' | 'falhou';
}

export interface Journey {
  id: string;
  name: string;
  description: string;
  type: 'agentica' | 'automacao';
  domainId: string;
  initiativeId?: string;
  triggerLabel: string;
  risk: 'assistida' | 'supervisionada' | 'autonoma';
  /** Jornada do roteiro guiado. */
  anchor?: boolean;
  /** Fornecido pelo cérebro (coluna da tabela de jornadas-âncora). */
  brainInputs: string[];
  versions: JourneyVersion[];
  /** Versão publicada em cada ambiente (null = ausente). */
  envVersions: Record<EnvId, string | null>;
  persona: { name: string; message: string };
  script: Record<string, StepScript>;
  testCases: JourneyTestCase[];
  kpis: string[];
}

export interface Release {
  id: string;
  journeyId: string;
  from: EnvId;
  to: EnvId;
  version: string;
  at: string;
  by: string;
  status: 'promovida' | 'bloqueada' | 'rollback';
  trafficPct?: number;
}

export type InitiativeStage = 'ideia' | 'validacao' | 'prototipo' | 'construcao' | 'operacao';

export interface ValidationCheck {
  key: 'estrategia' | 'mercado' | 'regras' | 'dados' | 'integracoes' | 'arquitetura' | 'reuso' | 'business_case';
  label: string;
  result: 'verde' | 'amarelo' | 'vermelho';
  summary: string;
  source: string;
}

export interface Validation {
  checks: ValidationCheck[];
  recommendation: string;
  attention: string[];
  reusePct: number;
  solutionType: 'agente' | 'automacao' | 'aplicacao' | 'integracao' | 'produto_de_dados';
  decision?: 'seguir' | 'rever';
}

export interface Initiative {
  id: string;
  title: string;
  type: 'novo_produto' | 'nova_jornada' | 'eficiencia' | 'agente_ia' | 'modernizacao';
  domainId: string;
  owner: string;
  stage: InitiativeStage;
  expectedValueBRL: number;
  health: 'ok' | 'atencao' | 'risco';
  problem: string;
  objective: string;
  metric: string;
  journeyId?: string;
  validation?: Validation;
}

export interface BuildOrder {
  id: string;
  journeyId: string;
  journeyVersion: string;
  env: EnvId;
  status: 'na_fila' | 'plano_registrado' | 'em_construcao' | 'pronta_revisao' | 'concluida';
  repo: string;
  branch: string;
  createdAt: string;
  definitionOfDone: string[];
  plan: string[];
  progress: Record<string, 'pendente' | 'construido'>;
  evidences: string[];
  prUrl?: string;
  tokens?: number;
}

// ---------- Governar e medir ----------
export interface Policy {
  id: string;
  name: string;
  kind: 'stack' | 'jornada' | 'dado';
  description: string;
  /** Condição em linguagem simples: "quando ...". */
  condition: string;
  effect: 'bloquear' | 'exigir_aprovacao' | 'alertar';
  envs: EnvId[];
  active: boolean;
  /** Visão em código (JSON da regra). */
  code: string;
}

export interface Approval {
  id: string;
  kind: 'componente' | 'contrato' | 'promocao' | 'acesso';
  title: string;
  requestedBy: string;
  requestedAt: string;
  status: 'pendente' | 'aprovado' | 'reprovado' | 'ajuste';
  approverProfile: ProfileId;
  objectId: string;
  diff?: string;
  comments: { by: string; at: string; text: string }[];
}

export interface AuditEvent {
  id: string;
  at: string;
  actor: string;
  profile: ProfileId;
  action: string;
  object: string;
  env: EnvId;
}

export interface TraceStep {
  nodeId: string;
  label: string;
  input: string;
  output: string;
  rule?: string;
  source?: string;
  tokens: number;
  latencyMs: number;
  costBRL: number;
  status: 'ok' | 'alerta' | 'erro' | 'bloqueado';
}

export interface Execution {
  id: string;
  journeyId: string;
  channel: string;
  env: EnvId;
  at: string;
  result: 'sucesso' | 'transbordo' | 'erro' | 'bloqueado';
  latencyMs: number;
  tokens: number;
  costBRL: number;
  guardrail?: string;
  steps: TraceStep[];
}

export interface MetricSeries {
  id: string;
  view: 'operacao' | 'agentica' | 'engenharia' | 'negocio' | 'dados';
  name: string;
  unit: string;
  /** 90 dias, data ISO (AAAA-MM-DD). */
  points: { date: string; value: number }[];
  baseline?: number;
  better: 'up' | 'down';
}

export interface Suggestion {
  id: string;
  kind: 'skill' | 'regra';
  title: string;
  evidence: string;
  proposal: string;
  journeyId?: string;
  sourceDocId?: string;
  status: 'nova' | 'aceita' | 'descartada';
}

export interface CockpitKpi {
  name: string;
  unit: string;
  baseline: number;
  current: number;
  target: number;
  better: 'up' | 'down';
}

export interface Cockpit {
  funnel: { stage: InitiativeStage; count: number; valueBRL: number }[];
  valueKpis: CockpitKpi[];
  adoption: { label: string; value: string }[];
  engineering: { label: string; before: number; after: number; unit: string }[];
  risks: { id: string; kind: 'politica' | 'conector' | 'aprovacao'; title: string; severity: 'alta' | 'media' | 'baixa' }[];
}

// ---------- Agregado por workspace ----------
export interface WorkspaceData {
  workspace: Workspace;
  users: User[];
  systems: EcosystemSystem[];
  connectors: Connector[];
  channels: Channel[];
  ideConnections: IdeConnection[];
  domains: DataDomain[];
  contracts: DataContract[];
  tables: LakeTable[];
  sqlExamples: SqlExample[];
  lineage: Lineage;
  collections: KnowledgeCollection[];
  documents: KnowledgeDocument[];
  retrievals: RetrievalExample[];
  knowledgeGraph: KnowledgeGraph;
  brainAreas: BrainArea[];
  artifacts: BrainArtifact[];
  radar: RadarItem[];
  decisionTables: DecisionTable[];
  components: Component[];
  journeys: Journey[];
  releases: Release[];
  initiatives: Initiative[];
  buildOrders: BuildOrder[];
  policies: Policy[];
  approvals: Approval[];
  audit: AuditEvent[];
  executions: Execution[];
  metrics: MetricSeries[];
  suggestions: Suggestion[];
  cockpit: Cockpit;
  /** Valores do Cockpit "antes do Córtex" (slide 8). */
  cockpitBefore: Cockpit;
}
