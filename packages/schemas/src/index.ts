// Contrato entre a API e a aplicação web.
// Árvore de cada workspace: núcleo (dados mestre) → frentes de negócio → jornadas →
// desenho da jornada e capacidades técnicas. Todo nó tem texto versionado e arquivos versionados.

export type NodeKind = 'core' | 'front' | 'journey' | 'design' | 'capability';

export type CapabilityId = 'arquitetura' | 'engenharia' | 'seguranca' | 'dados' | 'design_system';

export const CAPABILITIES: { id: CapabilityId; label: string; hint: string }[] = [
  { id: 'arquitetura', label: 'Arquitetura', hint: 'Padrões de arquitetura e tecnologias adotadas na jornada.' },
  { id: 'engenharia', label: 'Engenharia de software', hint: 'Convenções de código, testes, versionamento e entrega.' },
  { id: 'seguranca', label: 'Segurança', hint: 'Controles, dados sensíveis, LGPD e gestão de segredos.' },
  { id: 'dados', label: 'Dados', hint: 'Entidades, fontes, contratos e qualidade dos dados usados.' },
  { id: 'design_system', label: 'Design System', hint: 'Componentes, tokens visuais e padrões de interface.' },
];

export const CAPABILITY_IDS = CAPABILITIES.map((c) => c.id);

/** Tamanho máximo de um arquivo enviado. */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

export interface Workspace {
  id: string;
  name: string;
  segment: string;
  tagline: string;
  createdAt: string;
  frontCount: number;
  journeyCount: number;
}

/** Nó da árvore com o conteúdo da versão atual. */
export interface TreeNode {
  id: string;
  kind: NodeKind;
  capability: CapabilityId | null;
  parentId: string | null;
  name: string;
  summary: string;
  body: string;
  version: number;
  updatedAt: string;
  updatedBy: string;
  fileCount: number;
  children: TreeNode[];
}

export interface WorkspaceTree {
  workspace: Workspace;
  core: TreeNode;
}

export interface NodeVersion {
  version: number;
  name: string;
  summary: string;
  body: string;
  note: string;
  createdAt: string;
  createdBy: string;
}

export interface FileVersion {
  version: number;
  size: number;
  mime: string;
  sha256: string;
  createdAt: string;
  createdBy: string;
}

export interface NodeFile {
  id: string;
  nodeId: string;
  name: string;
  /** Versão atual. */
  current: FileVersion;
  versionCount: number;
}

// ---------- Corpos de requisição ----------
export interface CreateWorkspaceInput {
  name: string;
  segment?: string;
  tagline?: string;
}

export interface CreateNodeInput {
  parentId: string;
  kind: 'front' | 'journey';
  name: string;
  summary?: string;
}

export interface UpdateNodeInput {
  name?: string;
  summary?: string;
  body?: string;
  note?: string;
}

/** Cabeçalho com o nome de quem está editando (ainda não há login). */
export const AUTHOR_HEADER = 'x-cortex-author';
