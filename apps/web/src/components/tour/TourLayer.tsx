'use client';

// Motor visual da jornada guiada (seção 13): seletor de roteiro, navegação
// entre telas, destaque do alvo, narrador, piloto automático, pontos de
// restauração, barra de capítulos e sincronização com as notas do apresentador.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Compass, X } from 'lucide-react';
import type { TourStep } from '@cortex/schemas';
import { TOUR_CHAPTERS, advanceActionId, stepsForScript } from '@cortex/tour';
import { useCortex } from '@/lib/store';
import { hasAutoAction, onTourAction, runAutoAction, sleep } from '@/lib/tour-bus';
import { CHAPTER_BAR_HEIGHT, ChapterBar } from './ChapterBar';
import { Narrator, type PilotState } from './Narrator';
import { ScriptPicker } from './ScriptPicker';
import { Spotlight, useTourTarget } from './Spotlight';
import { endTour, jumpToChapter, nextStep, prevStep, readingDelay, routeMatches, scriptOf } from './controller';
import { openTourChannel, writeSyncState, type TourSyncMessage } from './sync';

const PANEL_WIDTH = 380;
const PANEL_HEIGHT_GUESS = 560;
const ADVANCE_AFTER_ACTION_MS = 900;
const PILOT_WAIT_MS = 5000;

function hrefFor(route: string): string {
  return route === '/' ? '/' : `${route}/`;
}

function isTypingTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

export function TourLayer() {
  const tour = useCortex((s) => s.tour);
  const presentation = useCortex((s) => s.presentation);
  const pathname = usePathname();
  const router = useRouter();

  // Retomada após recarregar a página: o tour persistido continua sem passar pelo seletor.
  const [sessionStarted, setSessionStarted] = useState(tour.active);
  useEffect(() => {
    if (!tour.active) setSessionStarted(false);
  }, [tour.active]);

  const steps = useMemo(() => stepsForScript(tour.scriptId), [tour.scriptId]);
  const script = scriptOf(tour.scriptId);
  const index = Math.min(Math.max(tour.stepIndex, 0), Math.max(steps.length - 1, 0));
  const step: TourStep | undefined = steps[index];
  const chapter = step ? TOUR_CHAPTERS.find((c) => c.id === step.chapter) : undefined;

  const picking = tour.active && !sessionStarted;
  const running = tour.active && sessionStarted && !!step;
  const guided = running && !tour.detached;
  const routeOk = step ? routeMatches(step.route, pathname) : false;
  const stepId = step?.id ?? '';

  const stepRef = useRef(step);
  stepRef.current = step;

  const goRoute = useCallback(
    (s: TourStep) => {
      if (s.route !== '*' && !routeMatches(s.route, window.location.pathname)) router.push(hrefFor(s.route));
    },
    [router],
  );

  // ---------- Navegação ao entrar no passo ----------
  useEffect(() => {
    if (guided && step) goRoute(step);
    // Só ao entrar no passo (ou voltar ao roteiro): o apresentador pode navegar livremente depois.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guided, stepId]);

  // ---------- Destaque ----------
  const target = useTourTarget(step?.target, guided && routeOk, stepId);

  // ---------- Piloto / execução do passo ----------
  const [pilot, setPilot] = useState<{ stepId: string; state: PilotState }>({ stepId: '', state: 'idle' });
  const pilotState: PilotState = pilot.stepId === stepId ? pilot.state : 'idle';

  /** Espera a tela e o handler da ação ficarem prontos e executa. Retorna se executou. */
  const waitAndRun = useCallback(async (s: TourStep, cancelled: () => boolean): Promise<boolean> => {
    if (!s.autoAction) return false;
    setPilot({ stepId: s.id, state: 'waiting' });
    const deadline = Date.now() + PILOT_WAIT_MS;
    const targetSel = s.target ? `[data-tour="${s.target}"]` : null;
    let targetDeadline = Date.now() + 2000;
    while (!cancelled()) {
      const onRoute = routeMatches(s.route, window.location.pathname);
      const ready = onRoute && hasAutoAction(s.autoAction);
      const targetReady = !targetSel || !!document.querySelector(targetSel) || Date.now() > targetDeadline;
      if (ready && targetReady) break;
      if (!onRoute) targetDeadline = Date.now() + 2000;
      if (Date.now() > deadline) {
        setPilot({ stepId: s.id, state: 'unavailable' });
        return false;
      }
      await sleep(200);
    }
    if (cancelled()) return false;
    setPilot({ stepId: s.id, state: 'running' });
    let ok = false;
    try {
      ok = await runAutoAction(s.autoAction);
    } catch {
      ok = false;
    }
    if (!cancelled()) setPilot({ stepId: s.id, state: ok ? 'idle' : 'unavailable' });
    return ok;
  }, []);

  const runCurrentStep = useCallback(() => {
    const s = stepRef.current;
    if (!s?.autoAction) return;
    goRoute(s);
    void waitAndRun(s, () => stepRef.current?.id !== s.id);
  }, [goRoute, waitAndRun]);

  // ---------- Avanço por ação concluída na tela ----------
  useEffect(() => {
    if (!guided || !step) return;
    const expected = advanceActionId(step);
    if (!expected) return;
    let timer: number | undefined;
    const off = onTourAction((id) => {
      if (id !== expected || timer) return;
      timer = window.setTimeout(() => {
        const s = useCortex.getState();
        if (stepsForScript(s.tour.scriptId)[s.tour.stepIndex]?.id === step.id) nextStep();
      }, ADVANCE_AFTER_ACTION_MS);
    });
    return () => {
      off();
      if (timer) window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guided, stepId]);

  // ---------- Piloto automático ----------
  useEffect(() => {
    if (!guided || !tour.autopilot || !step) return;
    let cancelled = false;
    const isCancelled = () => cancelled;
    const stillHere = () => {
      const s = useCortex.getState();
      return !cancelled && stepsForScript(s.tour.scriptId)[s.tour.stepIndex]?.id === step.id;
    };
    const isLast = index >= steps.length - 1;
    (async () => {
      if (step.autoAction) {
        // Pausa curta para a plateia ver o destaque antes do clique.
        await sleep(1200);
        if (cancelled) return;
        const ran = await waitAndRun(step, isCancelled);
        if (!ran || cancelled) return;
        if (step.advanceOn === 'next') {
          await sleep(readingDelay(step));
          if (stillHere() && !isLast) nextStep();
        } else {
          // Reserva: a tela deveria emitir a ação; se não emitir, segue mesmo assim.
          await sleep(3500);
          if (stillHere() && !isLast) nextStep();
        }
      } else if (step.advanceOn === 'next') {
        await sleep(readingDelay(step));
        if (stillHere() && !isLast) nextStep();
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guided, tour.autopilot, stepId]);

  // ---------- Teclado ----------
  useEffect(() => {
    if (!running) return;
    const h = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || isTypingTarget(e.target)) return;
      const s = useCortex.getState();
      if (s.tour.detached) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        nextStep();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prevStep();
      } else if (e.key === 'Escape') {
        s.setTour({ detached: true });
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [running]);

  // ---------- Sincronização com as notas do apresentador ----------
  const channelRef = useRef<BroadcastChannel | null>(null);
  const syncState = useMemo(
    () => ({ scriptId: tour.scriptId, stepIndex: index, active: tour.active, detached: tour.detached, at: Date.now() }),
    [tour.scriptId, index, tour.active, tour.detached],
  );
  const syncRef = useRef(syncState);
  syncRef.current = syncState;

  useEffect(() => {
    const ch = openTourChannel();
    channelRef.current = ch;
    if (!ch) return;
    ch.onmessage = (ev: MessageEvent<TourSyncMessage>) => {
      const msg = ev.data;
      if (!msg || typeof msg !== 'object') return;
      if (msg.type === 'hello') ch.postMessage({ type: 'state', ...syncRef.current } satisfies TourSyncMessage);
      else if (msg.type === 'cmd' && useCortex.getState().tour.active) {
        if (msg.cmd === 'next') nextStep();
        else prevStep();
      }
    };
    return () => {
      ch.close();
      channelRef.current = null;
    };
  }, []);

  useEffect(() => {
    writeSyncState(syncState);
    channelRef.current?.postMessage({ type: 'state', ...syncState } satisfies TourSyncMessage);
  }, [syncState]);

  // ---------- Posição do narrador: evita cobrir o alvo ----------
  const [side, setSide] = useState<'right' | 'left'>('right');
  const showBar = (presentation || tour.active) && !picking;
  const bottomOffset = showBar ? CHAPTER_BAR_HEIGHT + 12 : 16;
  useEffect(() => {
    const el = target.el;
    if (!el) {
      setSide('right');
      return;
    }
    const compute = () => {
      const r = el.getBoundingClientRect();
      const w = window.innerWidth;
      const h = window.innerHeight;
      const panelTop = h - bottomOffset - Math.min(PANEL_HEIGHT_GUESS, h - 120);
      const overlapsV = r.bottom > panelTop && r.top < h - bottomOffset;
      const overlapsRight = r.right > w - PANEL_WIDTH - 24 && overlapsV;
      const overlapsLeft = r.left < PANEL_WIDTH + 24 && overlapsV;
      setSide(overlapsRight && !overlapsLeft ? 'left' : 'right');
    };
    compute();
    const iv = window.setInterval(compute, 700);
    window.addEventListener('resize', compute);
    return () => {
      window.clearInterval(iv);
      window.removeEventListener('resize', compute);
    };
  }, [target.el, bottomOffset]);

  // ---------- Barra de capítulos ----------
  const onJump = useCallback(
    (c: number) => {
      const s = useCortex.getState();
      if (!s.tour.active) {
        setSessionStarted(true);
        s.setTour({ active: true, detached: false });
      }
      jumpToChapter(c);
    },
    [],
  );

  if (!tour.active && !presentation) return null;

  return (
    <>
      {picking && <ScriptPicker onStarted={() => setSessionStarted(true)} />}

      {guided && step && (
        <>
          {target.status === 'found' && <Spotlight el={target.el} />}
          <Narrator
            step={step}
            index={index}
            total={steps.length}
            script={script}
            chapter={chapter}
            routeOk={routeOk}
            targetStatus={step.target ? target.status : 'idle'}
            pilot={pilotState}
            side={side}
            bottomOffset={bottomOffset}
            onRunStep={runCurrentStep}
            onGoRoute={() => goRoute(step)}
            onChangeScript={() => setSessionStarted(false)}
          />
        </>
      )}

      {running && tour.detached && (
        <div
          className="fixed left-1/2 z-[65] flex -translate-x-1/2 items-center gap-1 rounded-full border border-primary/60 bg-surface-1/95 p-1 shadow-halo-green backdrop-blur"
          style={{ bottom: bottomOffset }}
        >
          <button
            onClick={() => useCortex.getState().setTour({ detached: false })}
            className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10"
          >
            <Compass className="h-4 w-4" strokeWidth={1.5} />
            Voltar ao roteiro
            <span className="font-mono text-xs text-text-muted">{index + 1}/{steps.length}</span>
          </button>
          <button aria-label="Encerrar roteiro" onClick={endTour} className="rounded-full p-1.5 text-text-muted hover:bg-surface-2 hover:text-text">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {showBar && <ChapterBar script={script} currentChapter={running ? (step?.chapter ?? null) : null} onJump={onJump} />}
    </>
  );
}
