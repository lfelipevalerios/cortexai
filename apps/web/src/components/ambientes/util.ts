import type { EnvId, Journey, JourneyGraph, WorkspaceData } from '@cortex/schemas';
import { diffGraphs } from '@cortex/engine';

export const ENV_WHO: Record<EnvId, string> = {
  dev: 'Champion AI, Engenheiro AI e Engenheiro de dados',
  hml: 'Promoção pelo Champion AI, com aprovação do CoE AI',
  prd: 'Somente por promoção aprovada pelo CoE AI e pelo dono de negócio',
};

export const GATES: { from: EnvId; to: EnvId; gates: string; approval: string }[] = [
  {
    from: 'dev',
    to: 'hml',
    gates: 'Sem problemas bloqueantes, suíte de testes passando, componentes homologados, credenciais de Hml configuradas',
    approval: 'Champion AI',
  },
  {
    from: 'hml',
    to: 'prd',
    gates: 'Tudo acima, nota de avaliação acima do mínimo da política, contratos compatíveis, políticas de Prd atendidas',
    approval: 'CoE AI e dono de negócio',
  },
];

export function graphOf(j: Journey, version: string | null | undefined): JourneyGraph | undefined {
  if (!version) return undefined;
  return j.versions.find((v) => v.version === version)?.graph;
}

export function versionIndex(j: Journey, version: string | null | undefined): number {
  if (!version) return -1;
  return j.versions.findIndex((v) => v.version === version);
}

/** Contagem do que muda entre duas versões (nós adicionados, removidos e alterados). */
export function diffCounts(j: Journey, from: string | null, to: string | null) {
  const a = graphOf(j, from);
  const b = graphOf(j, to);
  if (!a || !b) return null;
  const d = diffGraphs(a, b);
  return { added: d.added.length, removed: d.removed.length, changed: d.changed.length };
}

/** Versão anterior para rollback no ambiente: a última release mais antiga que a atual; senão, a versão anterior do histórico. */
export function rollbackTarget(ws: WorkspaceData, j: Journey, env: EnvId): string | null {
  const cur = j.envVersions[env];
  if (!cur) return null;
  const curIdx = versionIndex(j, cur);
  const fromReleases = ws.releases
    .filter((r) => r.journeyId === j.id && r.to === env && r.status !== 'bloqueada' && r.version !== cur)
    .filter((r) => {
      const idx = versionIndex(j, r.version);
      return idx >= 0 && (curIdx < 0 || idx < curIdx);
    })
    .sort((a, b) => (a.at < b.at ? 1 : -1));
  if (fromReleases[0]) return fromReleases[0].version;
  return curIdx > 0 ? j.versions[curIdx - 1].version : null;
}

export const PREFIX: Record<string, string> = { saude: 'sau', varejo: 'var', financeiro: 'fin', telecom: 'tel' };

export function semverSort(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
  return 0;
}
