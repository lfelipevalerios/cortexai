'use client';

// Notas do apresentador: segunda janela com a fala sugerida e o plano B do
// passo atual, sincronizada com a janela principal (BroadcastChannel e
// localStorage como reserva). Página autocontida, sem a casca da aplicação.

import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, LifeBuoy, MessageSquareQuote, NotebookPen } from 'lucide-react';
import { TOUR_CHAPTERS, TOUR_SCRIPTS, stepsForScript } from '@cortex/tour';
import { TOUR_SYNC_KEY, openTourChannel, readSyncState, type TourSyncMessage, type TourSyncState } from '@/components/tour/sync';

export default function PresenterNotesPage() {
  const [state, setState] = useState<TourSyncState | null>(null);
  const [connected, setConnected] = useState(false);
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    document.title = 'Notas do apresentador · Córtex';
    setState(readSyncState());
    const ch = openTourChannel();
    channelRef.current = ch;
    if (ch) {
      ch.onmessage = (ev: MessageEvent<TourSyncMessage>) => {
        const msg = ev.data;
        if (msg?.type === 'state') {
          const { type: _t, ...rest } = msg;
          setState(rest);
          setConnected(true);
        }
      };
      ch.postMessage({ type: 'hello' } satisfies TourSyncMessage);
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key === TOUR_SYNC_KEY && e.newValue) {
        try {
          setState(JSON.parse(e.newValue) as TourSyncState);
        } catch {
          /* ignora */
        }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('storage', onStorage);
      ch?.close();
      channelRef.current = null;
    };
  }, []);

  const send = (cmd: 'next' | 'prev') => channelRef.current?.postMessage({ type: 'cmd', cmd } satisfies TourSyncMessage);

  const script = state ? TOUR_SCRIPTS.find((s) => s.id === state.scriptId) : undefined;
  const steps = state ? stepsForScript(state.scriptId) : [];
  const idx = state ? Math.min(Math.max(state.stepIndex, 0), Math.max(steps.length - 1, 0)) : 0;
  const step = steps[idx];
  const next = steps[idx + 1];
  const chapter = step ? TOUR_CHAPTERS.find((c) => c.id === step.chapter) : undefined;

  return (
    <div className="min-h-screen bg-bg px-5 py-5 text-text">
      <header className="mb-4 flex items-center gap-2">
        <NotebookPen className="h-5 w-5 text-primary" strokeWidth={1.5} />
        <h1 className="flex-1 text-base font-semibold">Notas do apresentador</h1>
        <span
          className={`rounded-full border px-2 py-0.5 text-xs ${connected ? 'border-primary/50 text-primary' : 'border-border text-text-muted'}`}
          title={connected ? 'Sincronizado com a janela principal' : 'Aguardando a janela principal'}
        >
          {connected ? 'Sincronizado' : 'Aguardando'}
        </span>
      </header>

      {!state || !step ? (
        <p className="rounded-card border border-border bg-surface-1 p-4 text-sm text-text-muted">
          Abra o tour na janela principal. As notas acompanham o passo atual automaticamente.
        </p>
      ) : (
        <main aria-live="polite">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-text-muted">
            <span className="rounded-full border border-accent/50 bg-accent/10 px-2 py-0.5 font-mono text-accent">Cap. {step.chapter}</span>
            <span>{chapter?.title} · {chapter?.screen}</span>
            <span className="ml-auto">
              Roteiro {script?.name} · passo {idx + 1} de {steps.length}
            </span>
          </div>
          {!state.active && <p className="mb-3 text-xs text-warning">O tour está encerrado na janela principal.</p>}
          {state.active && state.detached && <p className="mb-3 text-xs text-warning">O apresentador saiu do roteiro para explorar.</p>}

          <h2 className="mb-1 text-xl font-semibold leading-snug">{step.title}</h2>
          <p className="mb-4 text-sm text-text-muted">{step.narration}</p>

          <section className="mb-4 rounded-card border border-primary/40 bg-primary/5 p-4">
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-primary">
              <MessageSquareQuote className="h-4 w-4" strokeWidth={1.5} /> Fala sugerida
            </h3>
            <p className="text-lg leading-relaxed">{step.speech}</p>
          </section>

          <section className="mb-4 rounded-card border border-warning/40 bg-warning/5 p-4">
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-warning">
              <LifeBuoy className="h-4 w-4" strokeWidth={1.5} /> Plano B
            </h3>
            <p className="text-sm leading-relaxed">{step.planB}</p>
          </section>

          {chapter && (
            <p className="mb-4 text-sm text-text-muted">
              <span className="font-medium text-text">Momento de impacto:</span> {chapter.impact}.
            </p>
          )}

          {next && (
            <p className="mb-5 rounded-field border border-border bg-surface-1 px-3 py-2 text-xs text-text-muted">
              A seguir: <span className="text-text">{next.title}</span>
              {next.chapter !== step.chapter && <> (capítulo {next.chapter})</>}
            </p>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={() => send('prev')}
              disabled={idx === 0 || !state.active}
              className="inline-flex h-10 items-center gap-1.5 rounded-full border border-border px-4 text-sm hover:border-accent disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" /> Anterior
            </button>
            <button
              onClick={() => send('next')}
              disabled={!next || !state.active}
              className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full bg-primary px-4 text-sm font-medium text-on-primary hover:bg-primary-soft disabled:opacity-40"
            >
              Próximo <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </main>
      )}
    </div>
  );
}
