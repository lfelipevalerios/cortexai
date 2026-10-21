// Interpretador de jornadas no modo demonstração: percorre o grafo e devolve
// os passos roteirizados (seção 16, "Motor de jornadas").
import type { Journey, JourneyEdge, JourneyGraph, JourneyNode, StepScript, TraceStep } from '@cortex/schemas';
import { maskPii } from './format';

export const MAX_TRACE_STEPS = 50;
export const PII_FILTER_SCRIPT_KEY = '__pii_filter__';

const TERMINAL_KINDS = new Set(['saida.encerrar', 'saida.responder']);

export function findTriggerNodes(graph: JourneyGraph): JourneyNode[] {
  const triggers = graph.nodes.filter((n) => n.category === 'gatilho');
  if (triggers.length) return triggers;
  const withIncoming = new Set(graph.edges.map((e) => e.target));
  return graph.nodes.filter((n) => !withIncoming.has(n.id));
}

export function outgoingEdges(graph: JourneyGraph, nodeId: string): JourneyEdge[] {
  return graph.edges.filter((e) => e.source === nodeId);
}

function pickEdge(edges: JourneyEdge[], script?: StepScript): JourneyEdge | undefined {
  if (edges.length <= 1) return edges[0];
  const handle = script?.takeHandle;
  if (handle) {
    const h = handle.toLowerCase();
    const byHandle = edges.find((e) => e.sourceHandle?.toLowerCase() === h) ?? edges.find((e) => e.label?.toLowerCase() === h);
    if (byHandle) return byHandle;
  }
  return edges[0];
}

function looksMasked(text: string): boolean {
  return /\*{2,}|•{2,}|\[mascarad|mascarad/i.test(text);
}

function scriptFor(journey: Journey, node: JourneyNode): StepScript | undefined {
  return journey.script[node.id] ?? (node.kind === 'guardrail.pii' ? journey.script[PII_FILTER_SCRIPT_KEY] : undefined);
}

function buildStep(journey: Journey, node: JourneyNode, prevOutput: string): TraceStep {
  const script = scriptFor(journey, node);
  const isGuardrail = node.category === 'guardrail';
  if (script) {
    const masked = isGuardrail && (looksMasked(script.output) || (node.kind === 'guardrail.pii' && maskPii(script.input) !== script.input));
    return {
      nodeId: node.id,
      label: node.label,
      input: script.input,
      output: script.output,
      rule: script.rule,
      source: script.source,
      tokens: script.tokens,
      latencyMs: script.latencyMs,
      costBRL: script.costBRL,
      status: masked ? 'alerta' : 'ok',
    };
  }
  // Passo genérico quando o roteiro não cobre o nó.
  let output = `${node.label}: etapa concluída`;
  let status: TraceStep['status'] = 'ok';
  if (node.kind === 'guardrail.pii') {
    output = maskPii(prevOutput);
    if (output !== prevOutput) status = 'alerta';
  } else if (node.category === 'gatilho') {
    output = journey.persona?.message || journey.triggerLabel || output;
  }
  return {
    nodeId: node.id,
    label: node.label,
    input: prevOutput,
    output,
    tokens: 0,
    latencyMs: 40,
    costBRL: 0,
    status,
  };
}

export interface SimulateOptions {
  /** Nó inicial; por padrão, o primeiro gatilho. */
  startNodeId?: string;
}

/** Executa a jornada passo a passo com saídas roteirizadas. */
export function simulateJourney(journey: Journey, graph: JourneyGraph, opts: SimulateOptions = {}): TraceStep[] {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const start = (opts.startNodeId && byId.get(opts.startNodeId)) || findTriggerNodes(graph)[0];
  const steps: TraceStep[] = [];
  if (!start) return steps;
  let current: JourneyNode | undefined = start;
  let prevOutput = journey.persona?.message ?? '';
  while (current && steps.length < MAX_TRACE_STEPS) {
    const step = buildStep(journey, current, prevOutput);
    steps.push(step);
    prevOutput = step.output;
    const edges = outgoingEdges(graph, current.id);
    // "Encerrar" sempre termina; "Responder" termina, salvo se houver continuação desenhada.
    if (current.kind === 'saida.encerrar' || (TERMINAL_KINDS.has(current.kind) && edges.length === 0)) break;
    const edge = pickEdge(edges, scriptFor(journey, current));
    current = edge ? byId.get(edge.target) : undefined;
  }
  return steps;
}

export interface StreamOptions extends SimulateOptions {
  /** Multiplicador de velocidade (2 = duas vezes mais rápido). */
  speed?: number;
  onDone?: (steps: TraceStep[]) => void;
}

export function stepDelayMs(latencyMs: number, speed = 1): number {
  const clamped = Math.min(1200, Math.max(250, latencyMs));
  return clamped / (speed > 0 ? speed : 1);
}

/** Emite os passos com atraso proporcional à latência, para animar o canvas. */
export function simulateJourneyStream(
  journey: Journey,
  graph: JourneyGraph,
  onStep: (step: TraceStep, index: number) => void,
  opts: StreamOptions = {},
): { cancel(): void; steps: TraceStep[] } {
  const steps = simulateJourney(journey, graph, opts);
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const emit = (i: number) => {
    if (cancelled) return;
    if (i >= steps.length) {
      opts.onDone?.(steps);
      return;
    }
    timer = setTimeout(() => {
      if (cancelled) return;
      onStep(steps[i], i);
      emit(i + 1);
    }, stepDelayMs(steps[i].latencyMs, opts.speed));
  };
  emit(0);
  return {
    steps,
    cancel() {
      cancelled = true;
      if (timer !== undefined) clearTimeout(timer);
    },
  };
}

export function summarizeTrace(steps: TraceStep[]): { tokens: number; latencyMs: number; costBRL: number } {
  let tokens = 0;
  let latencyMs = 0;
  let costBRL = 0;
  for (const s of steps) {
    tokens += s.tokens;
    latencyMs += s.latencyMs;
    costBRL += s.costBRL;
  }
  return { tokens, latencyMs, costBRL: Math.round(costBRL * 10000) / 10000 };
}
