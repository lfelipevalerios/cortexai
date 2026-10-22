'use client';

// Comandos da jornada guiada. Leem o estado atual do store no momento da
// chamada, para poderem ser usados por timers, teclado e a janela de notas.

import type { TourScript, TourStep } from '@cortex/schemas';
import { TOUR_SCRIPTS, chapterStartIndex, stepsForScript } from '@cortex/tour';
import { useCortex } from '@/lib/store';
import { applyChapterFlags, applyRestorePoint } from './restore';

export function scriptOf(id: TourScript['id']): TourScript {
  return TOUR_SCRIPTS.find((s) => s.id === id) ?? TOUR_SCRIPTS[0];
}

export function currentSteps(): TourStep[] {
  return stepsForScript(useCortex.getState().tour.scriptId);
}

/** Normaliza o pathname (sem barra final; vazio = "/"). */
export function normPath(p: string | null | undefined): string {
  const x = (p ?? '/').replace(/\/+$/, '');
  return x || '/';
}

export function routeMatches(stepRoute: string, pathname: string | null | undefined): boolean {
  return stepRoute === '*' || normPath(pathname) === stepRoute;
}

/**
 * Vai para o passo `index`.
 * - "jump": o apresentador saltou (barra de capítulos, seletor): aplica o ponto de restauração do capítulo.
 * - "seq": progressão normal; não restaura dados, exceto ao pular capítulos que o roteiro omite
 *   (ex.: Executivo 1 → 4), quando os marcos intermediários faltariam.
 */
export function goToStep(index: number, mode: 'seq' | 'jump' = 'seq') {
  const s = useCortex.getState();
  const steps = stepsForScript(s.tour.scriptId);
  if (index < 0 || index >= steps.length) return;
  const prev = steps[s.tour.stepIndex];
  const next = steps[index];
  if (mode === 'jump') {
    applyRestorePoint(next.chapter);
  } else if (!prev || prev.chapter !== next.chapter) {
    const forwardGap = prev && next.chapter > prev.chapter + 1 && index > s.tour.stepIndex;
    if (forwardGap) applyRestorePoint(next.chapter);
    else applyChapterFlags(next.chapter);
  }
  s.setTour({ stepIndex: index, detached: false });
}

export function nextStep() {
  goToStep(useCortex.getState().tour.stepIndex + 1, 'seq');
}

export function prevStep() {
  goToStep(useCortex.getState().tour.stepIndex - 1, 'seq');
}

/** Salta para o início do capítulo com o ponto de restauração. */
export function jumpToChapter(chapter: number) {
  const steps = currentSteps();
  const idx = chapterStartIndex(steps, chapter);
  if (idx < 0) return;
  goToStep(idx, 'jump');
}

/** Restaura o capítulo do passo atual e volta ao primeiro passo dele. */
export function restoreCurrentChapter() {
  const s = useCortex.getState();
  const steps = stepsForScript(s.tour.scriptId);
  const step = steps[s.tour.stepIndex];
  if (step) jumpToChapter(step.chapter);
}

export function startTour(opts: {
  scriptId: TourScript['id'];
  chapter: number;
  autopilot: boolean;
  presentation: boolean;
  restore: boolean;
}) {
  const s = useCortex.getState();
  const steps = stepsForScript(opts.scriptId);
  const idx = Math.max(0, chapterStartIndex(steps, opts.chapter));
  if (opts.restore) applyRestorePoint(steps[idx]?.chapter ?? 0);
  else applyChapterFlags(steps[idx]?.chapter ?? 0);
  setPresentationMode(opts.presentation);
  s.setTour({ active: true, scriptId: opts.scriptId, stepIndex: idx, autopilot: opts.autopilot, detached: false });
}

export function endTour() {
  useCortex.getState().setTour({ active: false, detached: false });
}

/** Modo apresentação: fonte maior, menu recolhido e tela cheia quando possível. */
export function setPresentationMode(on: boolean) {
  useCortex.getState().setPresentation(on);
  try {
    if (on && !document.fullscreenElement) void document.documentElement.requestFullscreen?.().catch(() => {});
    if (!on && document.fullscreenElement) void document.exitFullscreen?.().catch(() => {});
  } catch {
    /* navegador sem tela cheia */
  }
}

/** Tempo de leitura do piloto automático para passos sem ação (~4 s, cresce com o texto). */
export function readingDelay(step: TourStep): number {
  const len = step.title.length + step.narration.length;
  return Math.min(9000, Math.max(4000, 2200 + len * 18));
}
