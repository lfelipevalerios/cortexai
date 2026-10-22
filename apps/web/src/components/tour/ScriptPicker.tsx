'use client';

import { useEffect, useRef, useState } from 'react';
import { Bot, Compass, MonitorPlay, RotateCcw, X } from 'lucide-react';
import type { TourScript } from '@cortex/schemas';
import { TOUR_CHAPTERS, TOUR_SCRIPTS, stepsForScript } from '@cortex/tour';
import { useCortex } from '@/lib/store';
import { Button, cx } from '@/components/ui';
import { endTour, startTour } from './controller';
import { restoreSummary } from './restore';

export function Toggle({ checked, onChange, label, hint, icon: Icon }: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
  icon?: typeof Bot;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-field border border-border bg-surface-2/40 px-3 py-2.5 hover:border-accent/60">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx(
          'relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors',
          checked ? 'border-primary bg-primary/30' : 'border-border bg-surface-1',
        )}
      >
        <span className={cx('h-3.5 w-3.5 rounded-full transition-transform', checked ? 'translate-x-[18px] bg-primary' : 'translate-x-[2px] bg-text-muted')} />
      </button>
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 text-sm font-medium">
          {Icon && <Icon className="h-4 w-4 text-accent" strokeWidth={1.5} />}
          {label}
        </span>
        {hint && <span className="mt-0.5 block text-xs text-text-muted">{hint}</span>}
      </span>
    </label>
  );
}

/** Escolha do roteiro ao abrir o tour. */
export function ScriptPicker({ onStarted }: { onStarted: () => void }) {
  const tour = useCortex((s) => s.tour);
  const presentation = useCortex((s) => s.presentation);
  const [scriptId, setScriptId] = useState<TourScript['id']>(tour.scriptId);
  const script = TOUR_SCRIPTS.find((s) => s.id === scriptId) ?? TOUR_SCRIPTS[0];
  const [chapter, setChapter] = useState<number>(script.chapters[0]);
  const [autopilot, setAutopilot] = useState(tour.autopilot);
  const [pres, setPres] = useState(presentation);
  const [restore, setRestore] = useState(true);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!script.chapters.includes(chapter)) setChapter(script.chapters[0]);
  }, [script, chapter]);

  useEffect(() => {
    dialogRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
  }, []);

  const steps = stepsForScript(scriptId);

  const start = () => {
    startTour({ scriptId, chapter, autopilot, presentation: pres, restore });
    onStarted();
  };

  return (
    <div className="fixed inset-0 z-[66] flex items-center justify-center bg-bg/70 p-4" onKeyDown={(e) => e.key === 'Escape' && endTour()}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-picker-title"
        className="max-h-[92vh] w-full max-w-[720px] animate-fade-in overflow-auto rounded-card border border-border bg-surface-1 p-6 shadow-2xl"
      >
        <div className="mb-5 flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-primary/50 bg-primary/10 text-primary">
            <Compass className="h-5 w-5" strokeWidth={1.5} />
          </span>
          <div className="flex-1">
            <h2 id="tour-picker-title" className="text-lg font-semibold">Jornada guiada</h2>
            <p className="text-sm text-text-muted">A aplicação conta a história tela a tela, com ações reais acontecendo. Escolha o roteiro para o público de hoje.</p>
          </div>
          <button aria-label="Fechar" onClick={endTour} className="rounded-full p-1.5 text-text-muted hover:bg-surface-2 hover:text-text">
            <X className="h-4 w-4" />
          </button>
        </div>

        <fieldset className="mb-5">
          <legend className="mb-2 text-xs font-medium uppercase tracking-wide text-text-muted">Roteiro</legend>
          <div className="grid gap-3 sm:grid-cols-3">
            {TOUR_SCRIPTS.map((s, i) => {
              const on = s.id === scriptId;
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={on}
                  data-autofocus={i === 0 ? true : undefined}
                  onClick={() => setScriptId(s.id)}
                  className={cx(
                    'flex flex-col rounded-card border p-4 text-left transition-colors',
                    on ? 'border-primary bg-primary/10 shadow-halo-green' : 'border-border bg-surface-2/40 hover:border-accent/60',
                  )}
                >
                  <span className="text-base font-semibold">{s.name}</span>
                  <span className="mt-1 flex-1 text-xs text-text-muted">{s.audience}</span>
                  <span className="mt-3 font-mono text-xs text-accent">
                    {s.chapters.length} capítulos · {stepsForScript(s.id).length} passos
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="mb-5">
          <legend className="mb-2 text-xs font-medium uppercase tracking-wide text-text-muted">Começar do capítulo</legend>
          <div className="flex flex-wrap gap-2">
            {script.chapters.map((c) => {
              const ch = TOUR_CHAPTERS.find((x) => x.id === c);
              const on = c === chapter;
              return (
                <button
                  key={c}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setChapter(c)}
                  className={cx(
                    'rounded-full border px-3 py-1.5 text-xs transition-colors',
                    on ? 'border-primary bg-primary/15 text-primary' : 'border-border text-text-muted hover:border-accent hover:text-text',
                  )}
                >
                  <span className="font-mono">{c}</span> · {ch?.title}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-text-muted">
            {TOUR_CHAPTERS.find((x) => x.id === chapter)?.happens}. {steps.filter((s) => s.chapter === chapter).length} passos.
          </p>
        </fieldset>

        <div className="mb-6 grid gap-2 sm:grid-cols-2">
          <Toggle checked={autopilot} onChange={setAutopilot} icon={Bot} label="Piloto automático" hint="Executa sozinho os cliques e o preenchimento de cada passo." />
          <Toggle checked={pres} onChange={setPres} icon={MonitorPlay} label="Modo apresentação" hint="Tela cheia, fonte 10% maior, menu recolhido e barra de capítulos." />
          <div className="sm:col-span-2">
            <Toggle checked={restore} onChange={setRestore} icon={RotateCcw} label="Preparar os dados do capítulo" hint={restoreSummary(chapter)} />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={endTour}>Cancelar</Button>
          <Button variant="primary" onClick={start}>Começar roteiro {script.name.toLowerCase()}</Button>
        </div>
      </div>
    </div>
  );
}
