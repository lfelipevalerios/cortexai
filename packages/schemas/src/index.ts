// Modelo do Córtex: cada workspace tem um cérebro.
// Cérebro → núcleo (dados mestre) + frentes de negócio → jornadas →
// desenho da jornada e capacidades técnicas. Todo nó guarda texto e arquivos.

export interface Attachment {
  id: string;
  name: string;
  size: number;
  type: string;
  addedAt: string;
}

/** Conteúdo de qualquer nó da árvore. */
export interface NodeContent {
  text: string;
  files: Attachment[];
  updatedAt?: string;
}

export type CapabilityId = 'arquitetura' | 'engenharia' | 'seguranca' | 'dados' | 'design_system';

export const CAPABILITIES: { id: CapabilityId; label: string; hint: string }[] = [
  { id: 'arquitetura', label: 'Arquitetura', hint: 'Padrões de arquitetura e tecnologias adotadas na jornada.' },
  { id: 'engenharia', label: 'Engenharia de software', hint: 'Convenções de código, testes, versionamento e entrega.' },
  { id: 'seguranca', label: 'Segurança', hint: 'Controles, dados sensíveis, LGPD e gestão de segredos.' },
  { id: 'dados', label: 'Dados', hint: 'Entidades, fontes, contratos e qualidade dos dados usados.' },
  { id: 'design_system', label: 'Design System', hint: 'Componentes, tokens visuais e padrões de interface.' },
];

export interface Journey {
  id: string;
  name: string;
  summary: string;
  content: NodeContent;
  design: NodeContent;
  capabilities: Record<CapabilityId, NodeContent>;
}

export interface BusinessFront {
  id: string;
  name: string;
  summary: string;
  content: NodeContent;
  journeys: Journey[];
}

export interface Brain {
  /** Núcleo: dados mestre e informações globais do negócio. */
  core: NodeContent;
  fronts: BusinessFront[];
}

export interface Workspace {
  id: string;
  name: string;
  segment: string;
  tagline: string;
  brain: Brain;
}

/** Endereço de um nó da árvore. */
export type NodePath =
  | { kind: 'core' }
  | { kind: 'front'; frontId: string }
  | { kind: 'journey'; frontId: string; journeyId: string }
  | { kind: 'design'; frontId: string; journeyId: string }
  | { kind: 'capability'; frontId: string; journeyId: string; capability: CapabilityId };

export const emptyContent = (text = ''): NodeContent => ({ text, files: [] });

export function emptyCapabilities(): Record<CapabilityId, NodeContent> {
  return Object.fromEntries(CAPABILITIES.map((c) => [c.id, emptyContent()])) as Record<CapabilityId, NodeContent>;
}

export function getContent(brain: Brain, path: NodePath): NodeContent | null {
  if (path.kind === 'core') return brain.core;
  const front = brain.fronts.find((f) => f.id === path.frontId);
  if (!front) return null;
  if (path.kind === 'front') return front.content;
  const journey = front.journeys.find((j) => j.id === path.journeyId);
  if (!journey) return null;
  if (path.kind === 'journey') return journey.content;
  if (path.kind === 'design') return journey.design;
  return journey.capabilities[path.capability];
}

/** Todos os anexos abaixo de um nó (para limpar arquivos ao excluir). */
export function filesUnder(node: BusinessFront | Journey): Attachment[] {
  if ('journeys' in node) return [...node.content.files, ...node.journeys.flatMap(filesUnder)];
  return [...node.content.files, ...node.design.files, ...Object.values(node.capabilities).flatMap((c) => c.files)];
}
