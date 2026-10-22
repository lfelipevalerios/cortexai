'use client';

import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle, Bot, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Compass, LogOut, MonitorPlay,
  MoreHorizontal, NotebookPen, Play, RotateCcw, Square, Undo2,
} from 'lucide-react';
import type { TourChapter, TourScript, TourStep } from '@cortex/schemas';
import { advanceActionId } from '@cortex/tour';
import { useCortex } from '@/lib/store';
import { Button, cx } from '@/components/ui';
import { endTour, nextStep, prevStep, restoreCurrentChapter, setPresentationMode } from './controller';
import { openPresenterNotes } from './sync';

export type PilotState = 'idle' | 'waiting' | 'running' | 'unavailable';

export interface NarratorProps {
  step: TourStep;
  index: number;
  total: number;
  script: TourScript;
  chapter: TourChapter | undefined;
  routeOk: boolean;
  targetStatus: 'idle' | 'searching' | 'found' | 'missing';
  pilot: PilotState;
  side: 'right' | 'left';
  bottomOffset: number;
  onRunStep: () => void;
  onGoRoute: () => void;
  onChangeScript: () => void;
}

export function Narrator(p: NarratorProps) {
  const { step, index, total, script, chapter } = p;
  const autopilot = useCortex((s) => s.tour.autopilot);
  const presentation = useCortex((s) => s.presentation);
  const setTour = useCortex((s) => s.setTour);
  const resetDemo = useCortex((s) => s.resetDemo);
  const toast = useCortex((s) => s.toast);
  const [collapsed, setCollapsed] = useState(false);
  const [menu, setMenu] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [speechOpen, setSpeechOpen] = useState(true);
  const [planBOpen, setPlanBOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isLast = index >= total - 1;
  const waitsAction = advanceActionId(step);
  const problem = p.pilot === 'unavailable' || (p.routeOk && p.targetStatus === 'missing');

  // Plano B abre sozinho quando algo não saiu como esperado; fecha ao trocar de passo.
  useEffect(() => setPlanBOpen(false), [step.id]);
  useEffect(() => {
    if (problem) setPlanBOpen(true);
  }, [problem]);

  useEffect(() => {
    if (!menu) return;
    const h = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) {
        setMenu(false);
        setConfirmReset(false);
      }
    };
    window.addEventListener('mousedown', h);
    return () => window.removeEventListener('mousedown', h);
  }, [menu]);

  const pos: React.CSSProperties = { bottom: p.bottomOffset, ...(p.side === 'right' ? { right: 16 } : { left: 16 }) };

  if (collapsed) {
    return (
      <div
        role="dialog"
        aria-label="Narrador da jornada guiada (recolhido)"
        className="fixed z-[65] flex items-center gap-2 rounded-full border border-primary/50 bg-surface-1/95 py-1.5 pl-3 pr-1.5 shadow-2xl backdrop-blur"
        style={pos}
      >
        <Compass className="h-4 w-4 text-primary" strokeWidth={1.5} />
        <span className="max-w-[240px] truncate text-xs">
          <span className="font-mono text-text-muted">{index + 1}/{total}</span> · {step.title}
        </span>
        <button aria-label="Passo anterior" disabled={index === 0} onClick={prevStep} className="rounded-full p-1.5 hover:bg-surface-2 disabled:opacity-40">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button aria-label="Próximo passo" disabled={isLast} onClick={nextStep} className="rounded-full p-1.5 text-primary hover:bg-surface-2 disabled:opacity-40">
          <ChevronRight className="h-4 w-4" />
        </button>
        <button aria-label="Expandir narrador" onClick={() => setCollapsed(false)} className="rounded-full p-1.5 hover:bg-surface-2">
          <ChevronUp className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="tour-step-title"
      className="fixed z-[65] flex max-h-[calc(100vh-120px)] w-[380px] max-w-[calc(100vw-32px)] animate-fade-in flex-col rounded-card border border-border bg-surface-1/95 shadow-2xl backdrop-blur"
      style={pos}
    >
      {/* Cabeçalho */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <span className="rounded-full border border-accent/50 bg-accent/10 px-2 py-0.5 font-mono text-xs text-accent">
          Cap. {step.chapter}
        </span>
        <span className="min-w-0 flex-1 truncate text-xs text-text-muted">
          {chapter?.title} · {chapter?.screen}
        </span>
        {autopilot && (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary" title="Piloto automático ligado">
            <Bot className="h-3.5 w-3.5" strokeWidth={1.5} /> Piloto
          </span>
        )}
        <div ref={menuRef} className="relative">
          <button aria-label="Mais opções do roteiro" aria-expanded={menu} onClick={() => setMenu((m) => !m)} className="rounded-full p-1.5 text-text-muted hover:bg-surface-2 hover:text-text">
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {menu && (
            <div role="menu" className="absolute bottom-full right-0 mb-2 w-72 rounded-card border border-border bg-surface-1 p-1 shadow-2xl">
              <MenuItem icon={Bot} onClick={() => setTour({ autopilot: !autopilot })}>
                Piloto automático: {autopilot ? 'ligado' : 'desligado'}
              </MenuItem>
              <MenuItem icon={MonitorPlay} onClick={() => setPresentationMode(!presentation)}>
                Modo apresentação: {presentation ? 'ligado' : 'desligado'}
              </MenuItem>
              <MenuItem icon={NotebookPen} onClick={() => { openPresenterNotes(); setMenu(false); }}>
                Notas do apresentador
              </MenuItem>
              <MenuItem icon={Compass} onClick={() => { setMenu(false); p.onChangeScript(); }}>
                Trocar roteiro (atual: {script.name})
              </MenuItem>
              <div className="my-1 border-t border-border" />
              <MenuItem
                icon={RotateCcw}
                onClick={() => {
                  restoreCurrentChapter();
                  setMenu(false);
                  toast({ kind: 'sucesso', title: `Capítulo ${step.chapter} restaurado`, description: 'Os dados voltaram ao estado de entrada do capítulo.' });
                }}
              >
                Restaurar este capítulo
              </MenuItem>
              <MenuItem
                icon={Undo2}
                danger
                onClick={() => {
                  if (!confirmReset) return setConfirmReset(true);
                  resetDemo();
                  setMenu(false);
                  setConfirmReset(false);
                  toast({ kind: 'info', title: 'Demo restaurada', description: 'Todos os workspaces voltaram ao estado inicial.' });
                }}
              >
                {confirmReset ? 'Confirmar: apagar o progresso da demo' : 'Restaurar demo'}
              </MenuItem>
            </div>
          )}
        </div>
        <button aria-label="Recolher narrador" onClick={() => setCollapsed(true)} className="rounded-full p-1.5 text-text-muted hover:bg-surface-2 hover:text-text">
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>

      {/* Corpo */}
      <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
        <div aria-live="polite" aria-atomic="true">
          <h2 id="tour-step-title" className="text-base font-semibold leading-snug">{step.title}</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-text">{step.narration}</p>
        </div>
        {chapter && (
          <p className="mt-2 text-xs text-text-muted">
            <span className="font-medium text-primary">Por que importa:</span> {chapter.impact}.
          </p>
        )}

        {!p.routeOk && (
          <div className="mt-3 flex items-center gap-2 rounded-field border border-accent/40 bg-accent/5 px-3 py-2 text-xs">
            <span className="flex-1">Este passo acontece em <span className="font-mono">{step.route}</span>.</span>
            <button onClick={p.onGoRoute} className="rounded-full border border-accent/60 px-2.5 py-1 text-accent hover:bg-accent/10">Ir para a tela</button>
          </div>
        )}
        {problem && (
          <div role="status" className="mt-3 flex items-start gap-2 rounded-field border border-warning/40 bg-warning/5 px-3 py-2 text-xs">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" strokeWidth={1.5} />
            <span>
              {p.pilot === 'unavailable'
                ? 'O piloto automático não encontrou a ação nesta tela. Siga o plano B e avance com Próximo.'
                : 'O elemento deste passo não apareceu na tela. Siga o plano B ou avance com Próximo.'}
            </span>
          </div>
        )}

        <Collapsible title="Fala sugerida" open={speechOpen} onToggle={() => setSpeechOpen((o) => !o)}>
          <p className="text-sm italic leading-relaxed text-accent-soft">“{step.speech}”</p>
        </Collapsible>
        <Collapsible title="Plano B" open={planBOpen} onToggle={() => setPlanBOpen((o) => !o)} tone={problem ? 'warning' : undefined}>
          <p className="text-sm leading-relaxed text-text-muted">{step.planB}</p>
        </Collapsible>

        {waitsAction && (
          <p className="mt-3 text-xs text-text-muted">
            {p.pilot === 'running'
              ? 'Piloto executando o passo…'
              : p.pilot === 'waiting'
                ? 'Piloto aguardando a tela ficar pronta…'
                : 'Avança sozinho quando a ação for concluída na tela.'}
          </p>
        )}
      </div>

      {/* Progresso e ações */}
      <div className="border-t border-border px-4 py-3">
        <div className="mb-2 flex items-center justify-between text-xs text-text-muted">
          <span>Passo {index + 1} de {total}</span>
          <span>Roteiro {script.name}</span>
        </div>
        <div
          className="mb-3 h-1 overflow-hidden rounded-full bg-surface-2"
          role="progressbar"
          aria-label="Progresso do roteiro"
          aria-valuemin={1}
          aria-valuemax={total}
          aria-valuenow={index + 1}
        >
          <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${((index + 1) / total) * 100}%` }} />
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="tertiary" icon={ChevronLeft} disabled={index === 0} onClick={prevStep} aria-keyshortcuts="ArrowLeft">
            Anterior
          </Button>
          {step.autoAction && (
            <Button size="sm" variant="secondary" icon={Play} loading={p.pilot === 'running'} onClick={p.onRunStep}>
              Executar passo
            </Button>
          )}
          <span className="flex-1" />
          {isLast ? (
            <Button size="sm" variant="primary" icon={Square} onClick={endTour}>Concluir</Button>
          ) : (
            <Button size="sm" variant="primary" onClick={nextStep} aria-keyshortcuts="ArrowRight">
              Próximo <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
        <div className="mt-2 flex items-center justify-between">
          <button
            onClick={() => setTour({ detached: true })}
            aria-keyshortcuts="Escape"
            className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs text-text-muted hover:bg-surface-2 hover:text-text"
          >
            <LogOut className="h-3.5 w-3.5" strokeWidth={1.5} /> Sair do roteiro
          </button>
          <button onClick={endTour} className="rounded-full px-2 py-1 text-xs text-text-muted hover:bg-surface-2 hover:text-danger">
            Encerrar
          </button>
        </div>
      </div>
    </div>
  );
}

function MenuItem({ icon: Icon, children, onClick, danger }: { icon: typeof Bot; children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className={cx('flex w-full items-center gap-2 rounded-field px-3 py-2 text-left text-sm hover:bg-surface-2', danger && 'text-danger')}
    >
      <Icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
      <span className="flex-1">{children}</span>
    </button>
  );
}

function Collapsible({ title, open, onToggle, children, tone }: { title: string; open: boolean; onToggle: () => void; children: React.ReactNode; tone?: 'warning' }) {
  return (
    <div className={cx('mt-3 rounded-field border', tone === 'warning' ? 'border-warning/40' : 'border-border')}>
      <button
        aria-expanded={open}
        onClick={onToggle}
        className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-text-muted hover:text-text"
      >
        {title}
        <ChevronDown className={cx('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}
