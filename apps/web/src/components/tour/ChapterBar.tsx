'use client';

import { Compass, NotebookPen } from 'lucide-react';
import { TOUR_CHAPTERS } from '@cortex/tour';
import type { TourScript } from '@cortex/schemas';
import { cx } from '@/components/ui';
import { openPresenterNotes } from './sync';

export const CHAPTER_BAR_HEIGHT = 44;

/** Barra de capítulos no rodapé: capítulo atual destacado e salto direto (com restauração). */
export function ChapterBar({ script, currentChapter, onJump }: {
  script: TourScript;
  currentChapter: number | null;
  onJump: (chapter: number) => void;
}) {
  const currentPos = currentChapter === null ? -1 : script.chapters.indexOf(currentChapter);
  return (
    <nav
      aria-label="Capítulos do roteiro"
      className="fixed inset-x-0 bottom-0 z-[62] flex items-center gap-2 border-t border-border bg-bg/95 px-3 backdrop-blur"
      style={{ height: CHAPTER_BAR_HEIGHT }}
    >
      <span className="hidden shrink-0 items-center gap-1.5 pr-2 text-xs text-text-muted md:inline-flex">
        <Compass className="h-4 w-4 text-primary" strokeWidth={1.5} /> {script.name}
      </span>
      <ol className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
        {script.chapters.map((c, i) => {
          const ch = TOUR_CHAPTERS.find((x) => x.id === c);
          const on = c === currentChapter;
          const done = currentPos >= 0 && i < currentPos;
          return (
            <li key={c} className="shrink-0">
              <button
                onClick={() => onJump(c)}
                aria-current={on ? 'step' : undefined}
                title={`Ir para o capítulo ${c} (${ch?.title}) com os dados de entrada restaurados`}
                className={cx(
                  'flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors',
                  on
                    ? 'border-primary bg-primary/15 text-primary shadow-halo-green'
                    : done
                      ? 'border-border text-text hover:border-accent'
                      : 'border-transparent text-text-muted hover:border-border hover:text-text',
                )}
              >
                <span className={cx('font-mono', on ? 'text-primary' : 'text-accent')}>{c}</span>
                <span className="whitespace-nowrap">{ch?.title}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <button
        onClick={openPresenterNotes}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs text-text-muted hover:border-accent hover:text-text"
      >
        <NotebookPen className="h-3.5 w-3.5" strokeWidth={1.5} /> Notas do apresentador
      </button>
    </nav>
  );
}
