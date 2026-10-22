'use client';

// Studio de jornadas (seção 7): paleta, canvas, inspetor e painel inferior numa tela só.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ReactFlowProvider, useReactFlow, type Connection } from '@xyflow/react';
import {
  ArrowLeft, ArrowRight, ChevronDown, ChevronUp, Code2, FileEdit, Hammer, LayoutList, Network, Play, Rocket, Save,
  Wand2, LocateFixed, X, GitCompare,
} from 'lucide-react';
import { DEMO_IDS } from '@cortex/seed';
import {
  ENV_ORDER, ENVS, can, type BuildOrder, type EnvId, type Journey, type JourneyGraph, type JourneyNode, type NodeKindDef,
  type TraceStep,
} from '@cortex/schemas';
import {
  addNode, connect, diffGraphs, evaluateGates, graphToJson, isConnectionAllowed, removeEdges, removeNodes,
  simulateJourneyStream, suggestNextKinds, validateGraph, formatNumber, type GraphProblem,
} from '@cortex/engine';
import {
  Button, Chip, CodeBlock, EmptyState, EnvBadge, Modal, Mono, NoPermission, StatusChip, cx, useCan,
} from '@/components/ui';
import { cortex, demoNow, useCortex, useEnv, useProfile, useWs } from '@/lib/store';
import { emitTourAction, sleep, useAutoAction } from '@/lib/tour-bus';
import { Canvas } from './Canvas';
import { Palette } from './Palette';
import { Inspector } from './Inspector';
import { ListView } from './ListView';
import { TestPanel, IDLE_RUN, type RunState } from './TestPanel';
import { VersionsPanel } from './VersionsPanel';
import { PromotionModal, type PromotionResult } from './PromotionModal';
import { BuildModal, BuildProgress, type BuildCheck } from './Build';
import { KIND_BY_ID } from './icons';
import { NODE_H, NODE_W, type StudioNodeDeco } from './StudioNode';
import {
  brl4, buildOrderOf, channelLabel, cloneGraph, formatDateTime, nextBuildOrderId, nextMinor, nextReleaseId, prefixOf,
  RISK_LABEL, runSuiteOn, sameGraph, slugify, suiteResult, unfilteredPiiSinks, userName,
} from './lib';

type BottomTab = 'testar' | 'problemas' | 'versoes' | 'execucoes';
const EMPTY: JourneyGraph = { nodes: [], edges: [] };

const DEFAULT_DOD = [
  'Todos os nós da jornada implementados conforme o grafo',
  'Testes gerados dos casos do Studio passando',
  'validar_contra_padroes sem violações bloqueantes',
  'Filtro de PII aplicado antes de qualquer resposta no canal',
  'PR aberto com evidências anexadas',
];

export function Studio({ journeyId }: { journeyId?: string }) {
  const ws = useWs();
  const id = journeyId || DEMO_IDS[ws.workspace.industry].anchorJourneyId;
  const journey = ws.journeys.find((j) => j.id === id);
  if (!journey) {
    return (
      <EmptyState
        title="Jornada não encontrada"
        description="O identificador informado não existe neste workspace."
        action={<Link href="/jornadas"><Button variant="primary">Ver jornadas</Button></Link>}
      />
    );
  }
  return (
    <ReactFlowProvider>
      <StudioBody key={journey.id} journey={journey} />
    </ReactFlowProvider>
  );
}

function StudioBody({ journey }: { journey: Journey }) {
  const ws = useWs();
  const env = useEnv();
  const profile = useProfile();
  const mutate = useCortex((s) => s.mutate);
  const toast = useCortex((s) => s.toast);
  const replaceWorkspace = useCortex((s) => s.replaceWorkspace);
  const setEnv = useCortex((s) => s.setEnv);
  const rf = useReactFlow();
  const canEdit = useCan('editar_jornada');
  const profileCanEdit = can(profile, 'editar_jornada');

  const envVersion = journey.envVersions[env];
  const saved = journey.versions.find((v) => v.version === envVersion);

  // ---------- Rascunho (grafo em edição) ----------
  const [draft, setDraftState] = useState<JourneyGraph>(() => cloneGraph(saved?.graph ?? EMPTY));
  const draftRef = useRef(draft);
  const setDraft = useCallback((g: JourneyGraph) => {
    draftRef.current = g;
    setDraftState(g);
  }, []);
  const [selected, setSelected] = useState<string[]>([]);
  const [compare, setCompare] = useState<{ a: string; b: string } | null>(null);
  const resetKey = `${journey.id}|${env}|${envVersion ?? '-'}`;
  const lastKey = useRef(resetKey);
  useEffect(() => {
    if (lastKey.current === resetKey) return;
    lastKey.current = resetKey;
    setDraft(cloneGraph(saved?.graph ?? EMPTY));
    setSelected([]);
    setCompare(null);
  }, [resetKey, saved, setDraft]);

  const editable = canEdit && !!saved && !compare;
  const dirty = !!saved && !sameGraph(draft, saved.graph);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  const problems = useMemo(() => validateGraph(draft, { data: ws, env, risk: journey.risk }), [draft, ws, env, journey.risk]);
  const problemsRef = useRef(problems);
  problemsRef.current = problems;
  const problemsByNode = useMemo(() => {
    const m = new Map<string, GraphProblem[]>();
    for (const p of problems) if (p.nodeId) m.set(p.nodeId, [...(m.get(p.nodeId) ?? []), p]);
    return m;
  }, [problems]);
  const errorCount = problems.filter((p) => p.severity === 'erro').length;
  const warnCount = problems.length - errorCount;
  const piiProblem = problems.find((p) => p.code === 'pii_sem_filtro' && p.fix);

  // ---------- Painéis ----------
  const [bottomOpen, setBottomOpen] = useState(true);
  const [tab, setTab] = useState<BottomTab>('testar');
  const [view, setView] = useState<'canvas' | 'lista'>('canvas');
  const [halo, setHalo] = useState<string[]>([]);
  const [flashEnv, setFlashEnv] = useState<EnvId | null>(null);
  const [codeOpen, setCodeOpen] = useState(false);
  const [rollback, setRollback] = useState<{ env: EnvId; to: string } | null>(null);
  const canvasBox = useRef<HTMLDivElement>(null);

  // ---------- Teste ----------
  const [run, setRun] = useState<RunState>(IDLE_RUN);
  const [input, setInput] = useState(journey.persona.message);
  const streamRef = useRef<{ cancel(): void } | null>(null);
  const runRef = useRef(run);
  runRef.current = run;
  const [suiteRunning, setSuiteRunning] = useState(false);
  const [suiteIndex, setSuiteIndex] = useState(0);
  useEffect(() => () => streamRef.current?.cancel(), []);
  useEffect(() => {
    streamRef.current?.cancel();
    setRun(IDLE_RUN);
  }, [env]);

  // ---------- Construção ----------
  const [build, setBuild] = useState<{ checks: BuildCheck[]; ocId?: string } | null>(null);
  const [trackedOcId, setTrackedOcId] = useState<string | null>(null);
  const [showProgress, setShowProgress] = useState(false);
  const [progressCollapsed, setProgressCollapsed] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const simulatingRef = useRef(false);
  const [buildLog, setBuildLog] = useState<string[]>([]);
  const [localBuilt, setLocalBuilt] = useState<Set<string> | null>(null);
  useEffect(() => {
    const live = cortex.ws()?.buildOrders.find((o) => o.journeyId === journey.id && o.status !== 'concluida');
    if (live) {
      setTrackedOcId(live.id);
      setShowProgress(true);
      setProgressCollapsed(live.status === 'pronta_revisao');
    }
  }, [journey.id]);
  const trackedOc = trackedOcId ? ws.buildOrders.find((o) => o.id === trackedOcId) : undefined;
  const seedOc =
    ws.buildOrders.find((o) => o.status === 'concluida' && o.journeyId === journey.id) ?? ws.buildOrders.find((o) => o.status === 'concluida');
  const builtIds = useMemo(() => {
    if (!showProgress) return new Set<string>();
    if (localBuilt) return localBuilt;
    if (trackedOc && trackedOc.status !== 'concluida')
      return new Set(Object.entries(trackedOc.progress).filter(([, v]) => v === 'construido').map(([k]) => k));
    return new Set<string>();
  }, [showProgress, localBuilt, trackedOc]);

  // ---------- Comparação de versões ----------
  const diff = useMemo(() => {
    if (!compare) return null;
    const A = journey.versions.find((v) => v.version === compare.a);
    const B = journey.versions.find((v) => v.version === compare.b);
    if (!A || !B) return null;
    const d = diffGraphs(A.graph, B.graph);
    const removedNodes = A.graph.nodes.filter((n) => d.removed.includes(n.id));
    const ids = new Set([...B.graph.nodes, ...removedNodes].map((n) => n.id));
    const bEdges = new Set(B.graph.edges.map((e) => e.id));
    const extra = A.graph.edges.filter(
      (e) => !bEdges.has(e.id) && (d.removed.includes(e.source) || d.removed.includes(e.target)) && ids.has(e.source) && ids.has(e.target),
    );
    return { graph: { nodes: [...B.graph.nodes, ...removedNodes], edges: [...B.graph.edges, ...extra] }, d };
  }, [compare, journey.versions]);

  const shownGraph = diff ? diff.graph : draft;

  const compById = useMemo(() => new Map(ws.components.map((c) => [c.id, c])), [ws.components]);
  const decorate = useCallback(
    (nodeId: string): StudioNodeDeco => {
      const n = shownGraph.nodes.find((x) => x.id === nodeId);
      const comp = n?.componentId ? compById.get(n.componentId) : undefined;
      const diffState = diff
        ? diff.d.added.includes(nodeId)
          ? ('added' as const)
          : diff.d.removed.includes(nodeId)
            ? ('removed' as const)
            : diff.d.changed.includes(nodeId)
              ? ('changed' as const)
              : undefined
        : undefined;
      const runState =
        diff ? undefined
        : run.blockedNodeId === nodeId ? ('blocked' as const)
        : run.activeNodeId === nodeId ? ('running' as const)
        : run.doneIds.includes(nodeId) ? ('done' as const)
        : undefined;
      return {
        componentName: comp?.name,
        componentVersion: n?.componentVersion ?? comp?.version,
        problems: diff ? [] : (problemsByNode.get(nodeId) ?? []).map((p) => ({ severity: p.severity, message: p.message })),
        run: runState,
        shakeKey: run.blockedNodeId === nodeId ? run.shakeKey : undefined,
        halo: halo.includes(nodeId),
        built: !diff && builtIds.has(nodeId),
        diff: diffState,
      };
    },
    [shownGraph, compById, diff, run, problemsByNode, halo, builtIds],
  );
  const activeEdgeIds = useMemo(() => new Set(diff ? [] : run.edgeIds), [run.edgeIds, diff]);

  // ---------- Edição ----------
  const updateDraft = (fn: (g: JourneyGraph) => JourneyGraph) => setDraft(fn(draftRef.current));

  const addKindAt = (k: NodeKindDef, position: { x: number; y: number }, linkFrom?: string) => {
    if (!editable) return;
    const { graph, node } = addNode(draftRef.current, k, position);
    const g = linkFrom ? connect(graph, linkFrom, node.id) : graph;
    setDraft(g);
    setSelected([node.id]);
  };

  const addFromPalette = (k: NodeKindDef) => {
    if (!editable) return;
    const box = canvasBox.current?.getBoundingClientRect();
    const center = box ? rf.screenToFlowPosition({ x: box.left + box.width / 2, y: box.top + box.height / 2 }) : { x: 0, y: 0 };
    const jitter = (draftRef.current.nodes.length % 5) * 20;
    addKindAt(k, { x: Math.round((center.x - NODE_W / 2 + jitter) / 20) * 20, y: Math.round((center.y - NODE_H / 2 + jitter) / 20) * 20 });
  };

  const addNext = (kind: string) => {
    const from = draftRef.current.nodes.find((n) => n.id === selected[0]);
    const k = KIND_BY_ID.get(kind);
    if (!from || !k) return;
    addKindAt(k, { x: from.position.x + 300, y: from.position.y }, from.id);
  };

  const onConnect = (c: Connection) => {
    if (!editable) return;
    const check = isConnectionAllowed(draftRef.current, c.source, c.target, c.sourceHandle ?? undefined);
    if (!check.allowed) {
      toast({ kind: 'aviso', title: 'Ligação não permitida', description: check.reason });
      return;
    }
    updateDraft((g) => connect(g, c.source, c.target, c.sourceHandle ?? undefined));
  };

  const connectIds = (s: string, t: string, h?: string) => onConnect({ source: s, target: t, sourceHandle: h ?? null, targetHandle: null });

  const deleteItems = (nodeIds: string[], edgeIds: string[]) => {
    if (!editable || (!nodeIds.length && !edgeIds.length)) return;
    const prev = draftRef.current;
    setDraft(removeEdges(removeNodes(prev, nodeIds), edgeIds));
    setSelected([]);
    toast({
      kind: 'info',
      title: nodeIds.length ? `${nodeIds.length} nó(s) removido(s)` : `${edgeIds.length} ligação(ões) removida(s)`,
      description: 'A alteração ainda não foi salva.',
      undo: () => setDraft(prev),
    });
  };

  const moveNodes = (pos: Record<string, { x: number; y: number }>) => {
    if (!editable) return;
    const g = draftRef.current;
    const changed = g.nodes.some((n) => pos[n.id] && (pos[n.id].x !== n.position.x || pos[n.id].y !== n.position.y));
    if (!changed) return;
    setDraft({ ...g, nodes: g.nodes.map((n) => (pos[n.id] ? { ...n, position: pos[n.id] } : n)) });
  };

  const patchNode = (id: string, patch: Partial<JourneyNode>) =>
    updateDraft((g) => ({ ...g, nodes: g.nodes.map((n) => (n.id === id ? clean({ ...n, ...patch }) : n)) }));

  const goTo = (nodeId: string) => {
    setCompare(null);
    setView('canvas');
    setSelected([nodeId]);
    const n = draftRef.current.nodes.find((x) => x.id === nodeId);
    if (n) setTimeout(() => rf.setCenter(n.position.x + NODE_W / 2, n.position.y + NODE_H / 2, { zoom: 1.1, duration: 300 }), 50);
  };

  // ---------- Versões ----------
  const saveVersion = (note: string): string | null => {
    const data = cortex.ws();
    const j = data?.journeys.find((x) => x.id === journey.id);
    if (!data || !j) return null;
    const g = cloneGraph(draftRef.current);
    const v = nextMinor(j);
    const result = suiteResult(g, data, 'dev', j);
    mutate(
      (d) => {
        const jj = d.journeys.find((x) => x.id === j.id)!;
        jj.versions.push({ version: v, createdAt: demoNow(), author: userName(d, profile), note, graph: g });
        jj.envVersions.dev = v;
        jj.testCases = runSuiteOn(jj.testCases, result);
      },
      { action: 'Salvou nova versão da jornada', object: `${j.name} ${v}` },
    );
    toast({
      kind: 'sucesso',
      title: `Versão ${v} salva em Dev`,
      description: j.testCases.length ? `Suíte rodou na nova versão: ${j.testCases.length} casos ${result === 'passou' ? 'passando' : 'com falha'}.` : 'Nenhum caso de teste salvo ainda.',
    });
    return v;
  };

  const handleSave = () => {
    if (!editable || !dirty) return;
    saveVersion('Alterações salvas no Studio.');
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  // ---------- Testar ----------
  const runTest = (): Promise<'passou' | 'bloqueado' | 'vazio'> =>
    new Promise((resolve) => {
      streamRef.current?.cancel();
      const data = cortex.ws();
      const j = data?.journeys.find((x) => x.id === journey.id);
      if (!data || !j) return resolve('vazio');
      const g = draftRef.current;
      const sinks = unfilteredPiiSinks(g);
      const msg = input.trim() || j.persona.message;
      const jj: Journey = msg === j.persona.message ? j : { ...j, persona: { ...j.persona, message: msg } };
      setBottomOpen(true);
      setTab('testar');
      setCompare(null);
      let prev: string | undefined;
      let order: TraceStep[] = [];
      const handle = simulateJourneyStream(
        jj,
        g,
        (step, i) => {
          const edge = prev ? g.edges.find((e) => e.source === prev && e.target === step.nodeId) : undefined;
          prev = step.nodeId;
          const blocked = sinks.has(step.nodeId);
          const sinkNode = g.nodes.find((n) => n.id === step.nodeId);
          const s: TraceStep = blocked
            ? {
                ...step,
                status: 'bloqueado',
                output: `Dado PII chegaria ao ${channelLabel(data, sinkNode)} sem filtro`,
                rule: 'Hook «Mascarar PII antes de enviar ao canal»: nenhum dado pessoal sai para o canal sem o Filtro de PII',
                source: piiMessage(problemsRef.current),
              }
            : step;
          setRun((r) => ({
            ...r,
            steps: [...r.steps, s],
            doneIds: blocked ? r.doneIds : [...r.doneIds, s.nodeId],
            edgeIds: edge ? [...r.edgeIds, edge.id] : r.edgeIds,
            activeNodeId: blocked ? undefined : order[i + 1]?.nodeId,
            status: blocked ? 'bloqueado' : r.status,
            blockedNodeId: blocked ? s.nodeId : r.blockedNodeId,
            shakeKey: blocked ? Date.now() : r.shakeKey,
          }));
          if (blocked) {
            handle.cancel();
            toast({ kind: 'erro', title: 'Guardrail acionado no teste', description: s.output });
            resolve('bloqueado');
          }
        },
        {
          onDone: () => {
            setRun((r) => ({ ...r, status: 'passou', activeNodeId: undefined }));
            resolve('passou');
          },
        },
      );
      order = handle.steps;
      streamRef.current = handle;
      if (!order.length) {
        handle.cancel();
        setRun(IDLE_RUN);
        toast({ kind: 'aviso', title: 'Nada para executar', description: 'A jornada precisa de um gatilho ligado às etapas.' });
        return resolve('vazio');
      }
      setRun({ ...IDLE_RUN, status: 'running', input: msg, activeNodeId: order[0].nodeId });
    });

  const testAndEmit = async () => {
    const r = await runTest();
    if (r !== 'vazio') emitTourAction('studio.testar');
  };

  const saveCase = () => {
    const r = runRef.current;
    if (r.status !== 'passou') return;
    const last = r.steps[r.steps.length - 1];
    mutate(
      (d) => {
        const jj = d.journeys.find((x) => x.id === journey.id)!;
        const ids = new Set(jj.testCases.map((c) => c.id));
        let n = jj.testCases.length + 1;
        while (ids.has(`${jj.id}-tc${n}`)) n++;
        jj.testCases.push({
          id: `${jj.id}-tc${n}`,
          name: `Teste com ${jj.persona.name.split(' ·')[0]} (${n})`,
          input: r.input,
          expected: last?.output ?? '',
          lastResult: 'passou',
        });
      },
      { action: 'Salvou caso de teste', object: journey.name },
    );
    toast({ kind: 'sucesso', title: 'Caso de teste salvo', description: 'Ele roda a cada nova versão e vira gate de promoção.' });
  };

  const runSuite = async () => {
    const data = cortex.ws();
    const j = data?.journeys.find((x) => x.id === journey.id);
    if (!data || !j || !j.testCases.length || suiteRunning) return;
    setSuiteRunning(true);
    for (let i = 0; i < j.testCases.length; i++) {
      setSuiteIndex(i);
      await sleep(350);
    }
    const result = suiteResult(draftRef.current, data, env, j);
    mutate(
      (d) => {
        const jj = d.journeys.find((x) => x.id === j.id)!;
        jj.testCases = runSuiteOn(jj.testCases, result);
      },
      { action: 'Rodou suíte de testes', object: `${j.name} (${j.testCases.length} casos)` },
    );
    setSuiteRunning(false);
    setSuiteIndex(0);
    toast({
      kind: result === 'passou' ? 'sucesso' : 'aviso',
      title: result === 'passou' ? `Suíte passou: ${j.testCases.length} casos` : 'Suíte com falhas',
      description: result === 'passou' ? undefined : 'Há problema bloqueante no fluxo. Veja a aba Problemas.',
    });
  };

  // ---------- Problemas e correção ----------
  const fixPii = async () => {
    const p = problemsRef.current.find((x) => x.code === 'pii_sem_filtro' && x.fix);
    if (!p?.fix) {
      toast({ kind: 'info', title: 'Nenhum dado PII sem filtro', description: 'O fluxo já passa pelo Filtro de PII antes do canal.' });
      emitTourAction('studio.corrigir-pii');
      return;
    }
    if (!editable) {
      toast({ kind: 'aviso', title: 'Correção indisponível', description: 'A edição acontece em Dev, com perfil Champion AI ou Engenheiro AI.' });
      return;
    }
    setBottomOpen(true);
    setTab('problemas');
    const before = draftRef.current;
    const next = p.fix.apply(before);
    const added = next.nodes.find((n) => !before.nodes.some((b) => b.id === n.id));
    const comp = added?.componentId ? compById.get(added.componentId) : undefined;
    const g: JourneyGraph = comp
      ? { ...next, nodes: next.nodes.map((n) => (n.id === added!.id ? { ...n, componentVersion: comp.version } : n)) }
      : next;
    setDraft(g);
    setRun(IDLE_RUN);
    if (added) {
      setHalo([added.id]);
      setTimeout(() => setHalo([]), 3500);
      setTimeout(() => rf.fitView({ padding: 0.2, duration: 250 }), 80);
    }
    await sleep(900);
    saveVersion('Filtro de PII inserido pela validação (correção em um clique).');
    await sleep(600);
    await runTest();
    emitTourAction('studio.corrigir-pii');
  };

  const applyFix = (p: GraphProblem) => {
    if (p.code === 'pii_sem_filtro') return void fixPii();
    if (!p.fix || !editable) return;
    updateDraft((g) => p.fix!.apply(g));
    toast({ kind: 'sucesso', title: 'Correção aplicada', description: p.fix.label });
  };

  // ---------- Promoção ----------
  const [promo, setPromo] = useState<{ to: 'hml' | 'prd'; auto: boolean; key: number } | null>(null);
  const promoWaiter = useRef<((r: PromotionResult) => void) | null>(null);
  const openPromotion = (to: 'hml' | 'prd', auto: boolean) =>
    new Promise<PromotionResult>((resolve) => {
      promoWaiter.current?.('cancelada');
      promoWaiter.current = resolve;
      setPromo({ to, auto, key: Date.now() });
    });
  const onPromoFinished = (to: 'hml' | 'prd', r: PromotionResult) => {
    if (to === 'hml' && r === 'promovida') emitTourAction('studio.promover-hml');
    if (to === 'prd' && r !== 'cancelada') emitTourAction('promocao.tentar-prd');
    if (r === 'promovida') {
      setFlashEnv(to);
      setTimeout(() => setFlashEnv(null), 2600);
    }
    promoWaiter.current?.(r);
    promoWaiter.current = null;
  };

  // ---------- Construção ----------
  const enviarConstrucao = async (auto = false) => {
    const data = cortex.ws();
    const j = data?.journeys.find((x) => x.id === journey.id);
    if (!data || !j) return;
    const devV = j.versions.find((v) => v.version === j.envVersions.dev);
    if (!devV) {
      toast({ kind: 'aviso', title: 'Sem versão em Dev', description: 'Salve uma versão antes de enviar para construção.' });
      return;
    }
    if (dirtyRef.current && env === 'dev') toast({ kind: 'info', title: `A construção usa a versão salva v${devV.version}`, description: 'Alterações não salvas ficam de fora da OC.' });
    const gates = evaluateGates({ journey: j, version: devV, from: 'dev', to: 'hml', data, approvals: { champion: true } });
    const comp = gates.find((g) => g.id === 'componentes_homologados');
    const badContract = devV.graph.nodes.find((n) => n.contractId && data.contracts.find((c) => c.id === n.contractId)?.status !== 'publicado');
    const checks: BuildCheck[] = [
      { label: 'Componentes homologados', passed: !!comp?.passed, note: comp?.reason },
      { label: 'Contratos publicados', passed: !badContract, note: badContract ? `O nó «${badContract.label}» usa um contrato que não está publicado` : undefined },
    ];
    const r = runRef.current;
    if (j.testCases.length === 0) {
      if (r.status === 'passou' && r.steps.length) {
        const last = r.steps[r.steps.length - 1];
        mutate((d) => {
          const jj = d.journeys.find((x) => x.id === j.id)!;
          jj.testCases.push({ id: `${jj.id}-tc1`, name: `Teste com ${jj.persona.name.split(' ·')[0]}`, input: r.input, expected: last.output, lastResult: 'passou' });
        }, { action: 'Salvou caso de teste', object: j.name });
        checks.push({ label: 'Casos de teste salvos', passed: true, note: 'Caso criado automaticamente a partir do último teste que passou' });
      } else {
        checks.push({ label: 'Casos de teste salvos', passed: false, note: 'Nenhum caso salvo: rode o teste com a persona e salve como caso de teste' });
      }
    } else {
      checks.push({ label: 'Casos de teste salvos', passed: true, note: `${j.testCases.length} casos viram testes automatizados` });
    }
    if (checks.some((c) => !c.passed)) {
      setBuild({ checks });
      return;
    }
    const p = prefixOf(j.id);
    const ocId = nextBuildOrderId(data, p);
    const ref = data.buildOrders[0];
    const num = ocId.split('-oc-')[1];
    const oc: BuildOrder = {
      id: ocId,
      journeyId: j.id,
      journeyVersion: devV.version,
      env: 'dev',
      status: 'na_fila',
      repo: ref?.repo ?? `${data.workspace.id}/jornadas`,
      branch: `cortex/oc-${num}-${slugify(j.name)}`,
      createdAt: demoNow(),
      definitionOfDone: ref?.definitionOfDone?.length ? [...ref.definitionOfDone] : DEFAULT_DOD,
      plan: [],
      progress: Object.fromEntries(devV.graph.nodes.map((n) => [n.id, 'pendente' as const])),
      evidences: [],
    };
    mutate((d) => {
      d.buildOrders.unshift(oc);
    }, { action: 'Enviou jornada para construção', object: `${ocId} · ${j.name} ${devV.version}` });
    setTrackedOcId(ocId);
    setShowProgress(true);
    setProgressCollapsed(false);
    setLocalBuilt(null);
    setBuildLog([]);
    setBuild({ checks, ocId });
    toast({ kind: 'sucesso', title: `OC ${ocId} na fila`, description: `Rode /cortex:construir ${ocId}, executado no Claude Code.` });
    emitTourAction('studio.enviar-construcao');
    if (auto) {
      await sleep(2800);
      setBuild(null);
    }
  };

  const planB = async () => {
    if (simulatingRef.current) return;
    const data = cortex.ws();
    const seed = data?.buildOrders.find((o) => o.status === 'concluida' && o.journeyId === journey.id) ?? data?.buildOrders.find((o) => o.status === 'concluida');
    if (!seed) {
      toast({ kind: 'aviso', title: 'Nenhuma OC construída disponível' });
      return;
    }
    simulatingRef.current = true;
    setBuild(null);
    setCompare(null);
    setView('canvas');
    setTrackedOcId(seed.id);
    setShowProgress(true);
    setProgressCollapsed(false);
    setBuildLog([`Plano B: usando ${seed.id}, já construída e registrada pelo MCP`]);
    setSimulating(true);
    const lit = new Set<string>();
    setLocalBuilt(new Set(lit));
    for (const n of buildOrderOf(draftRef.current)) {
      await sleep(700);
      lit.add(n.id);
      setLocalBuilt(new Set(lit));
      setBuildLog((l) => [...l, `«${n.label}» construído · validar_contra_padroes ok`]);
    }
    setSimulating(false);
    simulatingRef.current = false;
    toast({ kind: 'sucesso', title: `${seed.id} pronta`, description: 'PR e evidências anexados à ordem de construção.' });
    emitTourAction('studio.simular-construcao');
  };

  const simulateBuild = async () => {
    if (simulatingRef.current) return;
    const data = cortex.ws();
    const j = data?.journeys.find((x) => x.id === journey.id);
    if (!data || !j) return;
    const open = (s: BuildOrder['status']) => s === 'na_fila' || s === 'plano_registrado' || s === 'em_construcao';
    const target =
      data.buildOrders.find((o) => o.id === trackedOcId && open(o.status)) ?? data.buildOrders.find((o) => o.journeyId === j.id && open(o.status));
    if (!target) return planB();
    simulatingRef.current = true;
    setBuild(null);
    setCompare(null);
    setView('canvas');
    setTrackedOcId(target.id);
    setShowProgress(true);
    setProgressCollapsed(false);
    setLocalBuilt(null);
    setBuildLog([]);
    setSimulating(true);
    const g = j.versions.find((v) => v.version === target.journeyVersion)?.graph ?? draftRef.current;
    const order = buildOrderOf(g);
    const upd = (fn: (o: BuildOrder) => void, audit?: { action: string; object: string }) =>
      mutate((d) => {
        const o = d.buildOrders.find((x) => x.id === target.id);
        if (o) fn(o);
      }, audit);
    upd(
      (o) => {
        o.status = 'plano_registrado';
        o.plan = order.map((n) => `Implementar "${n.label}" (${n.kind}) em src/${n.kind.split('.')[0]}/${n.id}.ts`);
      },
      { action: 'Registrou o plano da OC (executado no Claude Code)', object: target.id },
    );
    await sleep(1100);
    upd((o) => {
      o.status = 'em_construcao';
    }, { action: 'Iniciou a construção (executado no Claude Code)', object: target.id });
    await sleep(500);
    for (const n of order) {
      upd((o) => {
        o.progress[n.id] = 'construido';
      });
      setBuildLog((l) => [...l, `«${n.label}» construído · validar_contra_padroes: 0 violações`]);
      await sleep(700);
    }
    const tests = Math.max(1, j.testCases.length) * 4;
    setBuildLog((l) => [...l, `${tests} testes gerados dos casos do Studio: todos passando`]);
    await sleep(600);
    const prBase = data.buildOrders.find((o) => o.prUrl)?.prUrl;
    const prNum = 128 + data.buildOrders.length;
    const prUrl = prBase ? prBase.replace(/\/pull\/\d+$/, `/pull/${prNum}`) : `https://git.exemplo.com.br/${target.repo}/pull/${prNum}`;
    upd(
      (o) => {
        o.status = 'pronta_revisao';
        o.prUrl = prUrl;
        o.tokens = 280000 + order.length * 14500;
        o.evidences = [
          `${tests} testes gerados a partir dos casos do Studio: todos passando`,
          'validar_contra_padroes: 0 violações bloqueantes',
          'Hook "Mascarar PII antes de enviar ao canal" ativo em todas as respostas ao canal',
          'Plano aprovado pelo Champion AI no terminal',
          'Telemetria da sessão associada à OC',
        ];
      },
      { action: 'OC pronta para revisão (executado no Claude Code)', object: target.id },
    );
    setSimulating(false);
    simulatingRef.current = false;
    toast({ kind: 'sucesso', title: `${target.id} pronta para revisão`, description: 'PR aberto com evidências. A promoção Dev → Hml usa essas evidências como gate.' });
    emitTourAction('studio.simular-construcao');
  };

  // ---------- Rollback ----------
  const canRollback = (e: EnvId) => (e === 'dev' ? profileCanEdit : e === 'hml' ? profile === 'champion' : profile === 'champion' || profile === 'coe');
  const doRollback = () => {
    if (!rollback) return;
    const { env: e, to } = rollback;
    const from = journey.envVersions[e];
    const before = mutate(
      (d) => {
        const jj = d.journeys.find((x) => x.id === journey.id)!;
        jj.envVersions[e] = to;
        d.releases.unshift({
          id: nextReleaseId(d, prefixOf(journey.id)), journeyId: journey.id, from: e === 'prd' ? 'hml' : 'dev', to: e, version: to,
          at: demoNow(), by: userName(d, profile), status: 'rollback', ...(e === 'prd' ? { trafficPct: 100 } : {}),
        });
      },
      { action: 'Rollback de jornada', object: `${journey.name} ${ENVS[e].label}: ${from} → ${to}` },
    );
    setRollback(null);
    toast({
      kind: 'sucesso',
      title: `Rollback em ${ENVS[e].label}: v${to}`,
      description: 'Registrado na auditoria.',
      undo: before ? () => replaceWorkspace(before) : undefined,
    });
  };

  // ---------- Piloto automático ----------
  useAutoAction('studio.testar', async () => {
    await sleep(300);
    await testAndEmit();
  });
  useAutoAction('studio.corrigir-pii', async () => {
    setBottomOpen(true);
    setTab('problemas');
    await sleep(500);
    await fixPii();
  });
  useAutoAction('studio.promover-hml', async () => {
    await sleep(200);
    await openPromotion('hml', true);
  });
  useAutoAction('promocao.tentar-prd', async () => {
    await sleep(200);
    await openPromotion('prd', true);
  });
  useAutoAction('studio.enviar-construcao', async () => {
    await sleep(300);
    await enviarConstrucao(true);
  });
  useAutoAction('studio.simular-construcao', async () => {
    await sleep(200);
    await simulateBuild();
  });

  // ---------- Render ----------
  const selectedNode = selected.length === 1 && !diff ? draft.nodes.find((n) => n.id === selected[0]) : undefined;
  const releases = ws.releases.filter((r) => r.journeyId === journey.id);
  const executions = ws.executions.filter((x) => x.journeyId === journey.id).slice(0, 30);
  const devToHmlDone = !!journey.envVersions.dev && journey.envVersions.dev === journey.envVersions.hml;
  const codeJson = useMemo(
    () =>
      JSON.stringify(
        {
          id: journey.id,
          nome: journey.name,
          tipo: journey.type,
          dominio: ws.domains.find((d) => d.id === journey.domainId)?.name ?? journey.domainId,
          risco: journey.risk,
          gatilho: journey.triggerLabel,
          versao: envVersion,
          versoesPorAmbiente: journey.envVersions,
          entradasDoCerebro: journey.brainInputs,
          kpis: journey.kpis,
          casosDeTeste: journey.testCases.length,
          grafo: JSON.parse(graphToJson(draft)),
        },
        null,
        2,
      ),
    [journey, ws.domains, envVersion, draft],
  );

  return (
    <div className="flex h-[calc(100vh-112px)] min-h-[640px] flex-col overflow-hidden rounded-card border border-border bg-bg">
      {/* Barra superior */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-surface-1 px-3 py-2">
        <Link href="/jornadas" aria-label="Voltar para jornadas" className="rounded-full p-1.5 text-text-muted hover:bg-surface-2 hover:text-text">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-base font-semibold">{journey.name}</h1>
            <Mono className="text-text-muted">v{envVersion ?? '—'}</Mono>
            {dirty && <Chip tone="yellow" icon={FileEdit}>Não salvo</Chip>}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-text-muted">
            {ENV_ORDER.map((e) => (
              <span key={e} className={cx('inline-flex items-center gap-1 rounded-full transition-shadow duration-200', flashEnv === e && 'shadow-halo-green')}>
                <EnvBadge env={e} className={cx(e === env && 'ring-1 ring-current')} />
                <Mono>{journey.envVersions[e] ?? '—'}</Mono>
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <EnvBadge env={env} />
          {errorCount > 0 ? (
            <StatusChip status="erro" label={`${errorCount} erro${errorCount > 1 ? 's' : ''}`} />
          ) : warnCount > 0 ? (
            <StatusChip status="amarelo" label={`${warnCount} aviso${warnCount > 1 ? 's' : ''}`} />
          ) : (
            <StatusChip status="ok" label="Sem problemas" />
          )}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <Button size="sm" variant="tertiary" icon={Save} disabled={!editable || !dirty} onClick={handleSave} title="Salvar nova versão (Ctrl+S)">
            Salvar
          </Button>
          <Button size="sm" variant="secondary" icon={Play} data-tour="studio-testar" loading={run.status === 'running'} disabled={!saved} onClick={() => void testAndEmit()}>
            Testar com persona
          </Button>
          {/* Sem o modal aberto, o alvo dos gates aponta para o botão que o abre. */}
          <span data-tour={promo ? undefined : 'promocao-gates'} className="inline-flex rounded-full">
            <Button
              size="sm"
              variant="primary"
              icon={Rocket}
              data-tour="studio-promover"
              disabled={!journey.envVersions.dev || devToHmlDone}
              title={devToHmlDone ? 'A versão de Dev já está em Hml' : 'Promover Dev → Hml'}
              onClick={() => void openPromotion('hml', false)}
            >
              Promover
            </Button>
          </span>
          <Button
            size="sm"
            variant="tertiary"
            icon={ArrowRight}
            data-tour={promo?.to === 'prd' ? undefined : 'promocao-prd'}
            disabled={!journey.envVersions.hml || journey.envVersions.hml === journey.envVersions.prd}
            title={!journey.envVersions.hml ? 'A jornada ainda não está em Hml' : 'Promover Hml → Prd'}
            onClick={() => void openPromotion('prd', false)}
          >
            Promover para Prd
          </Button>
          <span data-tour={showProgress && trackedOc && !diff && saved && view === 'canvas' ? undefined : 'studio-progresso'} className="inline-flex rounded-full">
            <Button size="sm" variant="tertiary" icon={Hammer} data-tour="studio-construir" disabled={!journey.envVersions.dev || !profileCanEdit} onClick={() => void enviarConstrucao(false)}>
              Enviar para construção
            </Button>
          </span>
          <Button size="sm" variant="ghost" icon={Code2} onClick={() => setCodeOpen(true)}>
            Ver como código
          </Button>
        </div>
      </div>

      {!profileCanEdit ? (
        <div className="border-b border-border px-3 py-2">
          <NoPermission action="editar_jornada" />
        </div>
      ) : env !== 'dev' && saved ? (
        <div className="flex items-center gap-2 border-b border-border bg-surface-1 px-4 py-2 text-xs text-text-muted">
          <EnvBadge env={env} /> mostra a versão publicada em {ENVS[env].label}, somente leitura. A edição acontece em Dev.
          <Button size="sm" variant="ghost" onClick={() => setEnv('dev')}>Editar em Dev</Button>
        </div>
      ) : null}

      {!saved ? (
        <div className="flex flex-1 items-center justify-center p-6" data-tour="studio-canvas">
          <EmptyState
            title={`Esta jornada ainda não está em ${ENVS[env].label}`}
            description={`Nenhuma versão foi promovida para ${ENVS[env].label}. A versão em Dev é ${journey.envVersions.dev ?? '—'}.`}
            action={<Button variant="primary" onClick={() => setEnv('dev')}>Ver em Dev</Button>}
          />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          <Palette editable={editable} onAdd={addFromPalette} />
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex min-h-0 flex-1">
              <div ref={canvasBox} className="relative min-w-0 flex-1" data-tour="studio-canvas">
                {view === 'canvas' ? (
                  <Canvas
                    graph={shownGraph}
                    decorate={decorate}
                    activeEdgeIds={activeEdgeIds}
                    editable={editable}
                    selectedIds={selected}
                    onSelect={setSelected}
                    onMoveNodes={moveNodes}
                    onConnect={onConnect}
                    onDelete={deleteItems}
                    onDropKind={(kind, pos) => {
                      const k = KIND_BY_ID.get(kind);
                      if (k) addKindAt(k, pos);
                    }}
                    fitKey={`${resetKey}|${compare ? `${compare.a}-${compare.b}` : ''}`}
                  >
                    <CanvasToolbar view={view} setView={setView} />
                    {diff && compare && (
                      <div className="absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full border border-accent/50 bg-surface-1/95 px-3 py-1.5 text-xs shadow-halo-purple">
                        <GitCompare className="h-3.5 w-3.5 text-accent" />
                        <span>
                          <Mono>v{compare.a}</Mono> → <Mono>v{compare.b}</Mono>
                        </span>
                        <Chip tone="green">{diff.d.added.length} adicionado(s)</Chip>
                        <Chip tone="red">{diff.d.removed.length} removido(s)</Chip>
                        <Chip tone="purple">{diff.d.changed.length} alterado(s)</Chip>
                        <button onClick={() => setCompare(null)} aria-label="Fechar comparação" className="rounded-full p-0.5 text-text-muted hover:text-text">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                    {showProgress && trackedOc && !diff && (
                      <BuildProgress
                        oc={trackedOc}
                        nodes={draft.nodes}
                        builtIds={trackedOc.status === 'concluida' && !localBuilt ? new Set(draft.nodes.map((n) => n.id)) : builtIds}
                        log={buildLog}
                        simulating={simulating}
                        collapsed={progressCollapsed}
                        setCollapsed={setProgressCollapsed}
                        onSimulate={() => void simulateBuild()}
                        onPlanB={() => void planB()}
                        onClose={() => {
                          setShowProgress(false);
                          setLocalBuilt(null);
                        }}
                        planBAvailable={!!seedOc && seedOc.id !== trackedOc.id}
                      />
                    )}
                  </Canvas>
                ) : (
                  <div className="relative h-full">
                    <CanvasToolbar view={view} setView={setView} />
                    <div className="h-full pt-10">
                      <ListView
                        graph={draft}
                        problemsByNode={problemsByNode}
                        editable={editable}
                        selectedId={selected[0]}
                        onSelect={(id) => setSelected([id])}
                        onConnect={connectIds}
                        onRemove={(id) => deleteItems([id], [])}
                      />
                    </div>
                  </div>
                )}
              </div>
              {selectedNode && (
                <Inspector
                  key={selectedNode.id}
                  node={selectedNode}
                  data={ws}
                  editable={editable}
                  problems={problemsByNode.get(selectedNode.id) ?? []}
                  lastStep={run.steps.find((s) => s.nodeId === selectedNode.id)}
                  suggestions={suggestNextKinds(draft, selectedNode.id)}
                  onChange={(patch) => patchNode(selectedNode.id, patch)}
                  onClose={() => setSelected([])}
                  onFix={applyFix}
                  onAddNext={addNext}
                  onRemove={() => deleteItems([selectedNode.id], [])}
                />
              )}
            </div>

            {/* Painel inferior */}
            <div className="shrink-0 border-t border-border bg-surface-1">
              <div className="flex items-center gap-1 px-2" role="tablist" aria-label="Painel inferior">
                {(
                  [
                    ['testar', 'Testar'],
                    ['problemas', `Problemas${problems.length ? ` (${problems.length})` : ''}`],
                    ['versoes', `Versões (${journey.versions.length})`],
                    ['execucoes', 'Execuções'],
                  ] as [BottomTab, string][]
                ).map(([id, label]) => (
                  <button
                    key={id}
                    role="tab"
                    aria-selected={tab === id && bottomOpen}
                    data-tour={id === 'problemas' && !(bottomOpen && tab === 'problemas') ? 'studio-problemas' : undefined}
                    onClick={() => {
                      setTab(id);
                      setBottomOpen(true);
                    }}
                    className={cx(
                      '-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                      tab === id && bottomOpen ? 'border-primary text-text' : 'border-transparent text-text-muted hover:text-text',
                      id === 'problemas' && errorCount > 0 && 'text-danger',
                    )}
                  >
                    {label}
                  </button>
                ))}
                <button
                  className="ml-auto rounded-full p-1.5 text-text-muted hover:bg-surface-2 hover:text-text"
                  onClick={() => setBottomOpen((o) => !o)}
                  aria-label={bottomOpen ? 'Recolher painel' : 'Expandir painel'}
                >
                  {bottomOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                </button>
              </div>
              {bottomOpen && (
                <div className="h-[268px] border-t border-border p-3">
                  {tab === 'testar' && (
                    <TestPanel
                      journey={journey}
                      run={run}
                      input={input}
                      setInput={setInput}
                      onRun={() => void testAndEmit()}
                      onSaveCase={saveCase}
                      onRunSuite={() => void runSuite()}
                      suiteRunning={suiteRunning}
                      suiteIndex={suiteIndex}
                      onFixPii={() => void fixPii()}
                      hasPiiFix={!!piiProblem}
                      editable={editable}
                    />
                  )}
                  {tab === 'problemas' && (
                    <div data-tour="studio-problemas" className="h-full overflow-auto">
                      {problems.length === 0 ? (
                        <div className="flex h-full items-center justify-center text-sm text-primary">Nenhum problema: o fluxo está pronto para testar e promover.</div>
                      ) : (
                        <ul className="space-y-1.5">
                          {problems.map((p) => {
                            const node = p.nodeId ? draft.nodes.find((n) => n.id === p.nodeId) : undefined;
                            return (
                              <li
                                key={p.id}
                                className={cx('flex flex-wrap items-center gap-2 rounded-field border px-3 py-2', p.severity === 'erro' ? 'border-danger/40 bg-danger/5' : 'border-warning/40 bg-warning/5')}
                              >
                                <StatusChip status={p.severity === 'erro' ? 'erro' : 'amarelo'} label={p.severity === 'erro' ? 'Erro' : 'Aviso'} />
                                <span className="min-w-0 flex-1 text-sm">{p.message}</span>
                                {node && (
                                  <Button size="sm" variant="ghost" icon={LocateFixed} onClick={() => goTo(node.id)}>
                                    Ir ao nó
                                  </Button>
                                )}
                                {p.fix && (
                                  <Button
                                    size="sm"
                                    variant="primary"
                                    icon={Wand2}
                                    disabled={!editable}
                                    data-tour={p.code === 'pii_sem_filtro' ? 'studio-corrigir-pii' : undefined}
                                    onClick={() => applyFix(p)}
                                  >
                                    {p.fix.label}
                                  </Button>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  )}
                  {tab === 'versoes' && (
                    <VersionsPanel
                      journey={journey}
                      releases={releases}
                      onCompare={(a, b) => {
                        setCompare({ a, b });
                        setSelected([]);
                        setView('canvas');
                      }}
                      onRollback={(e, to) => setRollback({ env: e, to })}
                      canRollback={canRollback}
                    />
                  )}
                  {tab === 'execucoes' && <ExecutionsTab executions={executions} />}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {promo && (
        <PromotionModal
          key={promo.key}
          journey={journey}
          to={promo.to}
          auto={promo.auto}
          onClose={() => setPromo(null)}
          onGoTo={goTo}
          onFinished={(r) => onPromoFinished(promo.to, r)}
        />
      )}

      {build && (
        <BuildModal
          data={ws}
          journey={journey}
          checks={build.checks}
          oc={build.ocId ? ws.buildOrders.find((o) => o.id === build.ocId) : undefined}
          onClose={() => setBuild(null)}
          onFollow={() => setBuild(null)}
        />
      )}

      <Modal open={codeOpen} onClose={() => setCodeOpen(false)} width={760} title="Jornada como código" subtitle={`${journey.name} · JSON do grafo e metadados (v${envVersion ?? '—'}${dirty ? ', com alterações não salvas' : ''})`}>
        <CodeBlock code={codeJson} maxHeight={520} />
      </Modal>

      <Modal
        open={!!rollback}
        onClose={() => setRollback(null)}
        title={rollback ? `Rollback em ${ENVS[rollback.env].label}` : ''}
        subtitle={journey.name}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRollback(null)}>Cancelar</Button>
            <Button variant="danger" onClick={doRollback}>Confirmar rollback</Button>
          </>
        }
      >
        {rollback && (
          <div className="space-y-2 text-sm">
            <p>
              <EnvBadge env={rollback.env} /> passa de <Mono>v{journey.envVersions[rollback.env]}</Mono> para <Mono>v{rollback.to}</Mono>.
            </p>
            <p className="text-text-muted">Impacto:</p>
            <ul className="list-inside list-disc text-text-muted">
              {ws.channels.filter((c) => c.journeyByEnv[rollback.env] === journey.id).map((c) => (
                <li key={c.id}>Canal «{c.name}» passa a atender com a versão anterior</li>
              ))}
              <li>A suíte de testes e as execuções seguintes usam a versão v{rollback.to}</li>
              <li>O rollback fica registrado em releases e na auditoria</li>
            </ul>
          </div>
        )}
      </Modal>
    </div>
  );
}

function CanvasToolbar({ view, setView }: { view: 'canvas' | 'lista'; setView: (v: 'canvas' | 'lista') => void }) {
  return (
    <div className="absolute left-3 top-3 z-10 flex rounded-full border border-border bg-surface-1/95 p-0.5 text-xs" role="group" aria-label="Modo de visualização">
      <button
        onClick={() => setView('canvas')}
        aria-pressed={view === 'canvas'}
        className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-1', view === 'canvas' ? 'bg-surface-2 text-text' : 'text-text-muted')}
      >
        <Network className="h-3.5 w-3.5" /> Canvas
      </button>
      <button
        onClick={() => setView('lista')}
        aria-pressed={view === 'lista'}
        className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-1', view === 'lista' ? 'bg-surface-2 text-text' : 'text-text-muted')}
      >
        <LayoutList className="h-3.5 w-3.5" /> Lista
      </button>
    </div>
  );
}

function ExecutionsTab({ executions }: { executions: ReturnType<typeof useWs>['executions'] }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!executions.length) return <div className="flex h-full items-center justify-center text-sm text-text-muted">Nenhuma execução registrada para esta jornada.</div>;
  return (
    <ul className="h-full space-y-1 overflow-auto">
      {executions.map((x) => (
        <li key={x.id} className="rounded-field border border-border">
          <button className="flex w-full flex-wrap items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-surface-2" onClick={() => setOpen(open === x.id ? null : x.id)} aria-expanded={open === x.id}>
            <EnvBadge env={x.env} />
            <StatusChip status={x.result} label={x.result === 'bloqueado' ? 'Bloqueado' : undefined} />
            <span className="text-text-muted">{formatDateTime(x.at)}</span>
            <span className="font-mono text-text-muted">{formatNumber(x.latencyMs)} ms · {formatNumber(x.tokens)} tok · {brl4(x.costBRL)}</span>
            {x.guardrail && <Chip tone="red">Guardrail: {x.guardrail}</Chip>}
          </button>
          {open === x.id && (
            <ol className="space-y-0.5 border-t border-border px-3 py-2 text-xs">
              {x.steps.map((s, i) => (
                <li key={i} className="flex gap-2">
                  <span className="w-5 shrink-0 font-mono text-text-muted">{i + 1}.</span>
                  <span className="w-44 shrink-0 truncate font-medium">{s.label}</span>
                  <span className="min-w-0 flex-1 truncate text-text-muted" title={s.output}>{s.output}</span>
                </li>
              ))}
            </ol>
          )}
        </li>
      ))}
    </ul>
  );
}

function piiMessage(problems: GraphProblem[]): string | undefined {
  return problems.find((p) => p.code === 'pii_sem_filtro')?.message;
}

/** Remove campos vazios de um nó após edição no inspetor. */
function clean(n: JourneyNode): JourneyNode {
  const out = { ...n } as Record<string, unknown>;
  for (const k of ['componentId', 'componentVersion', 'ruleId', 'contractId', 'toolId', 'channelId']) if (!out[k]) delete out[k];
  return out as unknown as JourneyNode;
}
