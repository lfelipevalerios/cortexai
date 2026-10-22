// Regras do Catálogo: disponibilidade por ambiente, consumidores e diff sintetizado.
import type { Component, ComponentStatus, ComponentType, EnvId, Journey, WorkspaceData } from '@cortex/schemas';
import { ENV_ORDER } from '@cortex/schemas';
import { Bot, FileText, Package, Plug, Scale, Sparkles, Webhook, type LucideIcon } from 'lucide-react';

export const TYPE_ICON: Record<ComponentType, LucideIcon> = {
  skill: Sparkles,
  agent: Bot,
  rule: Scale,
  mcp: Plug,
  hook: Webhook,
  documento: FileText,
  pacote: Package,
};

export const LIFECYCLE: { id: ComponentStatus; label: string }[] = [
  { id: 'rascunho', label: 'Rascunho' },
  { id: 'em_revisao', label: 'Em revisão' },
  { id: 'homologado', label: 'Homologado' },
  { id: 'publicado_prd', label: 'Publicado em Prd' },
  { id: 'depreciado', label: 'Depreciado' },
];

/**
 * Onde o componente pode ser usado:
 * em revisão só em Dev; homologado em Dev e Hml; publicado em todos;
 * depreciado segue em Dev e Hml para quem já usa; rascunho só no espaço do autor.
 */
export function availableEnvs(status: ComponentStatus): EnvId[] {
  switch (status) {
    case 'em_revisao':
      return ['dev'];
    case 'homologado':
    case 'depreciado':
      return ['dev', 'hml'];
    case 'publicado_prd':
      return [...ENV_ORDER];
    default:
      return [];
  }
}

export interface ConsumerInfo {
  journeys: { journey: Journey; envs: EnvId[] }[];
  packages: Component[];
  dependents: Component[];
}

export function consumersOf(ws: WorkspaceData, c: Component): ConsumerInfo {
  const tableIds = new Set(ws.decisionTables.filter((t) => t.componentId === c.id).map((t) => t.id));
  const uses = (j: Journey, version: string | null) => {
    const v = version ? j.versions.find((x) => x.version === version) : undefined;
    return !!v?.graph.nodes.some((n) => n.componentId === c.id || (n.ruleId && tableIds.has(n.ruleId)));
  };
  const journeys = ws.journeys
    .filter((j) => j.versions.some((v) => v.graph.nodes.some((n) => n.componentId === c.id || (n.ruleId && tableIds.has(n.ruleId)))))
    .map((journey) => ({ journey, envs: ENV_ORDER.filter((e) => uses(journey, journey.envVersions[e])) }));
  const others = ws.components.filter((x) => x.id !== c.id && x.dependencies.includes(c.id));
  return { journeys, packages: others.filter((x) => x.type === 'pacote'), dependents: others.filter((x) => x.type !== 'pacote') };
}

/** Conteúdo da versão anterior: sintetizado a partir do changelog quando não há histórico guardado. */
export function previousVersion(c: Component): { version: string; content: string } | null {
  if (c.changelog.length < 2) return null;
  const prev = c.changelog[c.changelog.length - 2].version;
  const lines = c.content.split('\n');
  // A última linha com conteúdo é tratada como a novidade da versão atual.
  let cut = lines.length - 1;
  while (cut > 0 && !lines[cut].trim()) cut--;
  const before = lines
    .filter((_, i) => i !== cut || lines.length === 1)
    .map((l) => l.split(c.version).join(prev));
  if (lines.length === 1) before[0] = `${lines[0].replace(/\.\s*$/, '')} (sem o ajuste da ${c.version}).`;
  return { version: prev, content: before.join('\n') };
}

export function substituteFrom(c: Component): string | null {
  const last = c.changelog[c.changelog.length - 1];
  const m = /Substituto sugerido: (.+)$/.exec(last?.note ?? '');
  return m ? m[1] : null;
}

export function bumpPatch(v: string): string {
  const [a, b, p] = v.split('.').map((x) => Number(x) || 0);
  return `${a}.${b ?? 0}.${(p ?? 0) + 1}`;
}
