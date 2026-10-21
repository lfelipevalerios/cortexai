// Gates de promoção entre ambientes (seção 7, "Ambientes e promoção").
import { ENVS } from '@cortex/schemas';
import type {
  Component,
  ConnectorTool,
  DataClassification,
  EnvId,
  Journey,
  JourneyVersion,
  ProfileId,
  WorkspaceData,
} from '@cortex/schemas';
import { validateGraph } from './validate';
import { evaluatePolicies, minEvaluationScore } from './policy';
import { formatNumber } from './format';

export interface Gate {
  id: string;
  label: string;
  passed: boolean;
  reason?: string;
  nodeId?: string;
  approver?: ProfileId;
}

export interface GateInput {
  journey: Journey;
  version: JourneyVersion;
  from: EnvId;
  to: EnvId;
  data: WorkspaceData;
  approvals: { coe?: boolean; owner?: boolean; champion?: boolean };
}

const APPROVED_STATUS = new Set(['homologado', 'publicado_prd']);
const COMPONENT_STATUS_LABEL: Record<Component['status'], string> = {
  rascunho: 'em rascunho',
  em_revisao: 'em revisão',
  homologado: 'homologado',
  publicado_prd: 'publicado em Prd',
  depreciado: 'depreciado',
};

/** Nota em escala 0–5 (aceita 0–100 por tolerância). */
function scoreOf(c: Component): number {
  const s = c.evaluation?.score ?? 0;
  return s > 5 ? s / 20 : s;
}

function plural(n: number, sing: string, plur: string): string {
  return `${n} ${n === 1 ? sing : plur}`;
}

export function evaluateGates(input: GateInput): Gate[] {
  const { journey, version, to, data, approvals } = input;
  const graph = version.graph;
  const envLabel = ENVS[to].label;
  const toPrd = to === 'prd';
  const gates: Gate[] = [];

  // 1. Sem problemas bloqueantes
  const errors = validateGraph(graph, { data, env: to, risk: journey.risk }).filter((p) => p.severity === 'erro');
  gates.push({
    id: 'sem_bloqueantes',
    label: 'Sem problemas bloqueantes',
    passed: errors.length === 0,
    reason: errors.length ? `${plural(errors.length, 'problema bloqueante', 'problemas bloqueantes')}: ${errors[0].message}` : undefined,
    nodeId: errors.find((e) => e.nodeId)?.nodeId,
  });

  // 2. Suíte de testes
  const cases = journey.testCases;
  const failed = cases.filter((c) => c.lastResult === 'falhou');
  gates.push({
    id: 'testes',
    label: 'Suíte de testes passando',
    passed: cases.length > 0 && failed.length === 0,
    reason:
      cases.length === 0
        ? 'Nenhum caso de teste salvo para a jornada'
        : failed.length
          ? `${failed.length} de ${cases.length} casos falharam (ex.: «${failed[0].name}»)`
          : undefined,
  });

  // 3. Componentes homologados
  const compNodes = graph.nodes.filter((n) => n.componentId);
  const compById = new Map(data.components.map((c) => [c.id, c]));
  const badComp = compNodes.find((n) => {
    const c = compById.get(n.componentId!);
    return !c || !APPROVED_STATUS.has(c.status);
  });
  const badCompData = badComp ? compById.get(badComp.componentId!) : undefined;
  gates.push({
    id: 'componentes_homologados',
    label: 'Componentes homologados',
    passed: !badComp,
    reason: badComp
      ? badCompData
        ? `O componente «${badCompData.name}» do nó «${badComp.label}» está ${COMPONENT_STATUS_LABEL[badCompData.status]}`
        : `O nó «${badComp.label}» usa um componente que não existe no catálogo`
      : undefined,
    nodeId: badComp?.id,
  });

  // 4. Credenciais do ambiente de destino
  const toolNodes = graph.nodes.filter((n) => n.toolId);
  let credFail: { nodeId: string; reason: string } | undefined;
  for (const n of toolNodes) {
    const conn = data.connectors.find((c) => c.tools.some((t) => t.id === n.toolId));
    if (!conn) {
      credFail = { nodeId: n.id, reason: `A tool do nó «${n.label}» não pertence a nenhum conector` };
      break;
    }
    if (!conn.envs[to]) {
      credFail = { nodeId: n.id, reason: `O conector «${conn.name}» não tem credencial de ${envLabel} configurada` };
      break;
    }
  }
  gates.push({
    id: 'credenciais',
    label: `Credenciais de ${envLabel} configuradas`,
    passed: !credFail,
    reason: credFail?.reason,
    nodeId: credFail?.nodeId,
  });

  if (!toPrd) {
    gates.push({
      id: 'aprovacao_champion',
      label: 'Aprovação do Champion AI',
      passed: !!approvals.champion,
      reason: approvals.champion ? undefined : 'Aguardando aprovação do Champion AI',
      approver: 'champion',
    });
    return gates;
  }

  // 5. Nota de avaliação
  const minScore = minEvaluationScore(data.policies, 'prd');
  const comps = compNodes.map((n) => compById.get(n.componentId!)).filter((c): c is Component => !!c);
  const uniq = [...new Map(comps.map((c) => [c.id, c])).values()];
  const avg = uniq.length ? uniq.reduce((s, c) => s + scoreOf(c), 0) / uniq.length : null;
  const worst = uniq.slice().sort((a, b) => scoreOf(a) - scoreOf(b))[0];
  gates.push({
    id: 'nota_avaliacao',
    label: `Nota de avaliação ≥ ${formatNumber(minScore, 1)}`,
    passed: avg === null || avg >= minScore,
    reason:
      avg !== null && avg < minScore
        ? `Nota média ${formatNumber(avg, 1)} abaixo do mínimo ${formatNumber(minScore, 1)} da política (menor: «${worst.name}», ${formatNumber(scoreOf(worst), 1)})`
        : undefined,
    nodeId: avg !== null && avg < minScore ? compNodes.find((n) => n.componentId === worst.id)?.id : undefined,
  });

  // 6. Contratos compatíveis
  const contractNodes = graph.nodes.filter((n) => n.contractId);
  const badContract = contractNodes.find((n) => data.contracts.find((c) => c.id === n.contractId)?.status !== 'publicado');
  const badContractData = badContract ? data.contracts.find((c) => c.id === badContract.contractId) : undefined;
  gates.push({
    id: 'contratos',
    label: 'Contratos compatíveis',
    passed: !badContract,
    reason: badContract
      ? badContractData
        ? `O contrato «${badContractData.name}» usado em «${badContract.label}» está ${badContractData.status}`
        : `O nó «${badContract.label}» lê um contrato inexistente`
      : undefined,
    nodeId: badContract?.id,
  });

  // 7. Políticas de Prd
  const toolsById = new Map<string, ConnectorTool>(data.connectors.flatMap((c) => c.tools.map((t) => [t.id, t] as [string, ConnectorTool])));
  const unguarded = toolNodes.filter((n) => {
    const t = toolsById.get(n.toolId!);
    return t && t.mode === 'escrita' && t.enabledByEnv.prd && !t.policyId;
  });
  const classifications = new Set<DataClassification>();
  for (const n of contractNodes) {
    const c = data.contracts.find((x) => x.id === n.contractId);
    c?.versions[c.versions.length - 1]?.fields.forEach((f) => classifications.add(f.classification));
  }
  if (graph.nodes.some((n) => n.emitsPii)) classifications.add('pii');
  const hits = evaluatePolicies(data.policies, {
    env: 'prd',
    risk: journey.risk,
    journeyType: journey.type,
    dataClassifications: [...classifications],
    writeToolsWithoutPolicy: unguarded.map((n) => n.toolId!),
    hasOwnerApproval: !!approvals.owner,
    hasHumanNode: graph.nodes.some((n) => n.category === 'pessoas'),
  }).filter((h) => h.effect === 'bloquear');
  let polReason: string | undefined;
  if (unguarded.length) {
    const t = toolsById.get(unguarded[0].toolId!)!;
    polReason = `A tool de escrita «${t.name}» está ligada em Prd sem política associada`;
  } else if (hits.length) {
    polReason = `Política «${hits[0].policyName}» bloqueia: ${hits[0].message}`;
  }
  gates.push({
    id: 'politicas_prd',
    label: 'Políticas de Prd atendidas',
    passed: !polReason,
    reason: polReason,
    nodeId: unguarded[0]?.id,
  });

  // 8. Aprovações humanas
  gates.push({
    id: 'aprovacao_coe',
    label: 'Aprovação do CoE AI',
    passed: !!approvals.coe,
    reason: approvals.coe ? undefined : 'Aguardando aprovação do CoE AI',
    approver: 'coe',
  });
  gates.push({
    id: 'aprovacao_dono',
    label: 'Aprovação do dono de negócio',
    passed: !!approvals.owner,
    reason: approvals.owner ? undefined : 'Aguardando aprovação do dono de negócio',
    approver: 'dono_negocio',
  });
  return gates;
}

export function canPromote(gates: Gate[]): boolean {
  return gates.length > 0 && gates.every((g) => g.passed);
}

/** Primeiro gate reprovado, para o checklist que "para" no ponto do problema. */
export function firstFailedGate(gates: Gate[]): Gate | undefined {
  return gates.find((g) => !g.passed);
}
