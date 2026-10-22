'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { EnvId, Execution, Journey, JourneyGraph, TraceStep } from '@cortex/schemas';
import { containsPii, maskPii, simulateJourneyStream, summarizeTrace } from '@cortex/engine';
import { cortex, demoNow, useCortex } from '@/lib/store';
import { emitTourAction } from '@/lib/tour-bus';
import { PREFIX } from './channelMeta';

export interface ChatMsg {
  id: number;
  from: 'cliente' | 'bot' | 'sistema';
  text: string;
  at: string;
  /** Aviso exibido junto da mensagem (ex.: PII sem filtro). */
  warn?: string;
  masked?: boolean;
}

export interface RunTarget {
  journey: Journey;
  version: string;
  graph: JourneyGraph;
  /** Versão do ambiente ausente: usa a mais recente. */
  fallback: boolean;
}

/** Resolve a jornada e a versão vinculadas ao canal no ambiente. */
export function resolveTarget(channelId: string, env: EnvId): RunTarget | null {
  const ws = cortex.ws();
  if (!ws) return null;
  const ch = ws.channels.find((c) => c.id === channelId);
  const jid = ch?.journeyByEnv[env];
  const journey = jid ? ws.journeys.find((j) => j.id === jid) : undefined;
  if (!journey || journey.versions.length === 0) return null;
  const envVersion = journey.envVersions[env];
  const v = journey.versions.find((x) => x.version === envVersion) ?? journey.versions[journey.versions.length - 1];
  return { journey, version: v.version, graph: v.graph, fallback: !envVersion || envVersion !== v.version };
}

let msgSeq = 1;
const clock = () => demoNow().slice(11, 16);

export function useJourneyRun(channelId: string, env: EnvId) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [planned, setPlanned] = useState<TraceStep[]>([]);
  const [steps, setSteps] = useState<TraceStep[]>([]);
  const [graph, setGraph] = useState<JourneyGraph | null>(null);
  const [running, setRunning] = useState(false);
  const [lastExecution, setLastExecution] = useState<Execution | null>(null);
  const handle = useRef<{ cancel(): void } | null>(null);
  const mutate = useCortex((s) => s.mutate);

  useEffect(() => () => handle.current?.cancel(), []);

  // Troca de canal ou ambiente começa uma conversa nova.
  useEffect(() => {
    handle.current?.cancel();
    setMessages([]);
    setPlanned([]);
    setSteps([]);
    setRunning(false);
    setLastExecution(null);
  }, [channelId, env]);

  const reset = useCallback(() => {
    handle.current?.cancel();
    setMessages([]);
    setPlanned([]);
    setSteps([]);
    setRunning(false);
    setLastExecution(null);
  }, []);

  const send = useCallback(
    (text: string, opts: { speed?: number } = {}) =>
      new Promise<Execution | null>((resolve) => {
        const target = resolveTarget(channelId, env);
        const ws = cortex.ws();
        if (!target || !ws || !text.trim()) {
          resolve(null);
          return;
        }
        handle.current?.cancel();
        setMessages((m) => [...m, { id: msgSeq++, from: 'cliente', text: text.trim(), at: clock() }]);
        setSteps([]);
        setGraph(target.graph);
        setRunning(true);
        const kindOf = new Map(target.graph.nodes.map((n) => [n.id, n.kind]));
        const hasFilter = target.graph.nodes.some((n) => n.kind === 'guardrail.pii');
        const h = simulateJourneyStream(
          target.journey,
          target.graph,
          (s) => setSteps((p) => [...p, s]),
          {
            speed: opts.speed ?? 1.4,
            onDone: (all) => {
              const blocked = all.find((s) => s.status === 'bloqueado');
              const failed = all.find((s) => s.status === 'erro');
              const responder = [...all].reverse().find((s) => kindOf.get(s.nodeId) === 'saida.responder');
              const handoff = all.some((s) => kindOf.get(s.nodeId) === 'pessoas.transbordo');
              const raw = responder?.output ?? all[all.length - 1]?.output ?? '';
              const reply = hasFilter ? maskPii(raw) : raw;
              const leak = !hasFilter && containsPii(raw);
              let msg: ChatMsg;
              if (blocked) msg = { id: msgSeq++, from: 'sistema', text: `Resposta não enviada: ${blocked.output}`, at: clock() };
              else if (failed) msg = { id: msgSeq++, from: 'sistema', text: 'Não consegui concluir agora. Um atendente vai continuar a conversa.', at: clock() };
              else
                msg = {
                  id: msgSeq++,
                  from: 'bot',
                  text: reply,
                  at: clock(),
                  masked: hasFilter && reply !== raw,
                  ...(leak ? { warn: 'Dado pessoal na resposta sem filtro de PII' } : {}),
                };
              setMessages((m) => [...m, msg]);
              setRunning(false);
              const piiStep = all.find((s) => kindOf.get(s.nodeId) === 'guardrail.pii' && s.status === 'alerta');
              const sum = summarizeTrace(all);
              const exec: Execution = {
                id: `${PREFIX[ws.workspace.industry]}-ex-sim-${Date.now()}`,
                journeyId: target.journey.id,
                channel: channelId,
                env,
                at: demoNow(),
                result: blocked ? 'bloqueado' : failed ? 'erro' : handoff ? 'transbordo' : 'sucesso',
                latencyMs: sum.latencyMs,
                tokens: sum.tokens,
                costBRL: sum.costBRL,
                ...(blocked
                  ? { guardrail: blocked.label }
                  : piiStep
                    ? { guardrail: 'Filtro de PII: dados pessoais mascarados antes do canal' }
                    : {}),
                steps: all,
              };
              mutate((d) => {
                d.executions.unshift(exec);
              });
              setLastExecution(exec);
              emitTourAction('canal.enviar-mensagem');
              resolve(exec);
            },
          },
        );
        handle.current = h;
        setPlanned(h.steps);
      }),
    [channelId, env, mutate],
  );

  return { messages, planned, steps, graph, running, send, reset, lastExecution, setMessages };
}

export const fmtMs = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(1).replace('.', ',')} s` : `${ms} ms`);
