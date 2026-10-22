'use client';

// Enviar para construção (seção 9): checagem dos gates mínimos, resumo da OC e
// painel de progresso nó a nó sobre o canvas.
import Link from 'next/link';
import { CheckCircle2, ChevronDown, ChevronUp, ExternalLink, Hammer, Loader2, Package, Play, PlugZap, XCircle, X } from 'lucide-react';
import type { BuildOrder, Journey, JourneyGraph, WorkspaceData } from '@cortex/schemas';
import { formatNumber } from '@cortex/engine';
import { Button, CodeBlock, Modal, Mono, Progress, StatusChip, Term, cx } from '@/components/ui';
import { OC_STATUS, formatDateTime } from './lib';

export interface BuildCheck {
  label: string;
  passed: boolean;
  note?: string;
}

export function BuildModal({
  data, journey, checks, oc, onClose, onFollow,
}: {
  data: WorkspaceData;
  journey: Journey;
  checks: BuildCheck[];
  oc?: BuildOrder;
  onClose: () => void;
  onFollow: () => void;
}) {
  const blocked = !oc;
  const version = oc ? journey.versions.find((v) => v.version === oc.journeyVersion) : undefined;
  const graph: JourneyGraph = version?.graph ?? { nodes: [], edges: [] };
  const initiative = journey.initiativeId ? data.initiatives.find((i) => i.id === journey.initiativeId) : undefined;
  const rules = [...new Set(graph.nodes.map((n) => n.ruleId).filter(Boolean) as string[])].map(
    (id) => data.decisionTables.find((t) => t.id === id)?.name ?? data.components.find((c) => c.id === id)?.name ?? id,
  );
  const contracts = [...new Set(graph.nodes.map((n) => n.contractId).filter(Boolean) as string[])].map(
    (id) => data.contracts.find((c) => c.id === id)?.name ?? id,
  );
  const tools = [...new Set(graph.nodes.map((n) => n.toolId).filter(Boolean) as string[])].map(
    (id) => data.connectors.flatMap((c) => c.tools).find((t) => t.id === id)?.name ?? id,
  );
  const comps = [...new Set(graph.nodes.map((n) => n.componentId).filter(Boolean) as string[])]
    .map((id) => data.components.find((c) => c.id === id))
    .filter(Boolean)
    .map((c) => `${c!.name} ${c!.version}`);
  const policies = data.policies.filter((p) => p.active && p.envs.includes('dev'));
  const pack = data.components.find((c) => c.type === 'pacote' && c.packageKind === 'jornada' && (c.status === 'homologado' || c.status === 'publicado_prd'));
  const pluginVersion = pack?.outputs[0]?.replace(/^plugin\s+/, '') ?? `cortex@${oc?.journeyVersion ?? '0.1.0'}`;

  const contents: { title: string; detail: string }[] = oc
    ? [
        { title: 'Ordem', detail: `${oc.id} · ${initiative ? `iniciativa «${initiative.title}» · ` : ''}${journey.name} v${oc.journeyVersion} · ambiente Dev · ${oc.repo} · branch ${oc.branch} · ${oc.definitionOfDone.length} critérios de pronto` },
        { title: 'Especificação funcional', detail: `${graph.nodes.length} etapas da jornada${rules.length ? `; regras: ${rules.join(', ')}` : ''}; critérios de aceite dos casos de teste` },
        { title: 'Especificação técnica', detail: 'Arquitetura de referência, stack aprovada, padrões e ADRs aplicáveis do cérebro técnico' },
        { title: 'Especificação de experiência', detail: `Roteiro de conversa a partir da persona «${journey.persona.name}», tokens de design e textos` },
        { title: 'Grafo da jornada (JSON)', detail: `${graph.nodes.length} nós e ${graph.edges.length} ligações, cada nó mapeado para o artefato de código esperado` },
        { title: 'Contratos de dados (ODCS)', detail: contracts.length ? contracts.join(', ') : 'Nenhum contrato usado' },
        { title: 'OpenAPI das tools', detail: tools.length ? tools.join(', ') : 'Nenhuma tool de conector' },
        { title: 'Casos de teste', detail: `${journey.testCases.length} casos salvos no Studio, que viram testes automatizados` },
        { title: 'Políticas', detail: `${policies.length} políticas ativas traduzidas em hooks e checagens` },
        { title: 'Versão do plugin', detail: `${pluginVersion}${comps.length ? ` · fixados: ${comps.join(', ')}` : ''}` },
      ]
    : [];

  return (
    <Modal
      open
      onClose={onClose}
      width={680}
      title={blocked ? 'Envio para construção bloqueado' : <span>Ordem de construção <Mono className="text-sm">{oc!.id}</Mono> criada</span>}
      subtitle={`${journey.name} · gates mínimos da construção`}
      footer={
        blocked ? (
          <Button variant="primary" onClick={onClose}>Entendi</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>Fechar</Button>
            <Button variant="primary" icon={Hammer} onClick={onFollow}>Acompanhar no canvas</Button>
          </>
        )
      }
    >
      <div className="space-y-4">
        <ul className="space-y-1.5">
          {checks.map((c) => (
            <li key={c.label} className="flex items-start gap-2 text-sm">
              {c.passed ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />}
              <span>
                {c.label} <span className="text-text-muted">· {c.passed ? 'ok' : 'reprovado'}</span>
                {c.note && <span className={cx('block text-xs', c.passed ? 'text-text-muted' : 'text-danger')}>{c.note}</span>}
              </span>
            </li>
          ))}
        </ul>

        {oc && (
          <>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <StatusChip status={OC_STATUS[oc.status].status} label={OC_STATUS[oc.status].label} />
              <span className="text-text-muted">criada em {formatDateTime(oc.createdAt)} · <Mono>{oc.repo}</Mono> · <Mono>{oc.branch}</Mono></span>
            </div>
            <div>
              <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold"><Package className="h-3.5 w-3.5 text-accent" /> Pacote de construção</div>
              <ul className="divide-y divide-border rounded-field border border-border">
                {contents.map((c) => (
                  <li key={c.title} className="px-3 py-1.5 text-xs">
                    <span className="font-medium">{c.title}:</span> <span className="text-text-muted">{c.detail}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="mb-1.5 text-xs font-semibold">Definição de pronto</div>
              <ul className="list-inside list-disc text-xs text-text-muted">
                {oc.definitionOfDone.map((d) => <li key={d}>{d}</li>)}
              </ul>
            </div>
            <div>
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-semibold">Comando para rodar · executado no Claude Code</span>
                <Link href="/ides" className="inline-flex items-center gap-1 text-accent hover:underline">
                  <PlugZap className="h-3.5 w-3.5" /> Conectar o Claude Code
                </Link>
              </div>
              <CodeBlock code={`/cortex:construir ${oc.id}`} maxHeight={80} />
              <p className="mt-1.5 text-xs text-text-muted">
                O Claude Code lê a <Term term="OC">OC</Term> pelo <Term>MCP</Term> do Córtex, registra o plano e acende cada caixinha do Studio ao concluir o nó.
              </p>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

export function BuildProgress({
  oc, nodes, builtIds, log, simulating, collapsed, setCollapsed, onSimulate, onPlanB, onClose, planBAvailable,
}: {
  oc: BuildOrder;
  nodes: { id: string; label: string }[];
  builtIds: Set<string>;
  log: string[];
  simulating: boolean;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  onSimulate: () => void;
  onPlanB: () => void;
  onClose: () => void;
  planBAvailable: boolean;
}) {
  const built = nodes.filter((n) => builtIds.has(n.id)).length;
  const pct = nodes.length ? Math.round((built / nodes.length) * 100) : 0;
  const st = OC_STATUS[oc.status];
  const done = oc.status === 'pronta_revisao' || oc.status === 'concluida';
  const showDone = done && !simulating;

  return (
    <div
      data-tour="studio-progresso"
      className="absolute right-3 top-3 z-10 w-[340px] rounded-card border border-accent/50 bg-surface-1/95 shadow-halo-purple backdrop-blur"
    >
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Hammer className="h-4 w-4 text-accent" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-semibold">
            Construção <Mono>{oc.id}</Mono>
          </div>
          <div className="text-[11px] text-text-muted">executado no Claude Code · {built}/{nodes.length} nós</div>
        </div>
        <StatusChip status={simulating && done ? 'sincronizando' : st.status} label={simulating && done ? 'Acendendo' : st.label} />
        <button onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? 'Expandir progresso' : 'Recolher progresso'} className="rounded-full p-1 text-text-muted hover:bg-surface-2">
          {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </button>
        <button onClick={onClose} aria-label="Fechar progresso" className="rounded-full p-1 text-text-muted hover:bg-surface-2">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="px-3 py-2">
        <Progress value={pct} tone={pct === 100 ? 'green' : 'purple'} />
      </div>
      {!collapsed && (
        <div className="max-h-[300px] space-y-2 overflow-auto px-3 pb-3 text-xs">
          {oc.plan.length > 0 && (
            <details open={!done}>
              <summary className="cursor-pointer font-medium">Plano registrado ({oc.plan.length} passos)</summary>
              <ol className="mt-1 list-inside list-decimal space-y-0.5 text-text-muted">
                {oc.plan.map((p) => <li key={p} className="truncate" title={p}>{p}</li>)}
              </ol>
            </details>
          )}
          {log.length > 0 && (
            <ul className="space-y-0.5">
              {log.map((l, i) => (
                <li key={i} className="flex items-start gap-1.5 animate-fade-in">
                  <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-primary" /> <span>{l}</span>
                </li>
              ))}
            </ul>
          )}
          {simulating && (
            <div className="flex items-center gap-1.5 text-accent"><Loader2 className="h-3.5 w-3.5 animate-spin" /> construindo…</div>
          )}
          {showDone && oc.prUrl && (
            <div className="space-y-1.5 rounded-field border border-primary/40 bg-primary/5 p-2">
              <a href={oc.prUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                Pull request aberto <ExternalLink className="h-3 w-3" />
              </a>
              <ul className="list-inside list-disc text-text-muted">
                {oc.evidences.map((e) => <li key={e}>{e}</li>)}
              </ul>
              {oc.tokens !== undefined && <div className="font-mono text-[11px] text-text-muted">{formatNumber(oc.tokens)} tokens consumidos</div>}
            </div>
          )}
          {!simulating && !done && (
            <div className="space-y-1.5">
              <p className="text-text-muted">
                Aguardando <Mono>/cortex:construir {oc.id}</Mono> no terminal. Sem conexão ou perto do limite de uso? Use o plano B.
              </p>
              <div className="flex flex-wrap gap-1.5">
                <Button size="sm" variant="secondary" icon={Play} onClick={onSimulate}>Simular construção</Button>
                {planBAvailable && <Button size="sm" variant="tertiary" onClick={onPlanB}>Usar OC já construída (plano B)</Button>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
