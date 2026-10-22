'use client';

import { useEffect, useState } from 'react';
import { Bot, Smartphone } from 'lucide-react';
import type { Journey } from '@cortex/schemas';
import { maskPii } from '@cortex/engine';
import { cx } from '@/components/ui';
import { prototypeConversation } from './shared';

/** Protótipo de conversa (celular) montado com a persona e o roteiro da jornada. */
export function ConversationPrototype({ journey, company }: { journey: Journey | undefined; company: string }) {
  const conv = prototypeConversation(journey);
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    setPhase(0);
    const ts = [setTimeout(() => setPhase(1), 250), setTimeout(() => setPhase(2), 900), setTimeout(() => setPhase(3), 1900)];
    return () => ts.forEach(clearTimeout);
  }, [journey?.id]);

  if (!conv) {
    return (
      <div className="rounded-field border border-dashed border-border p-4 text-sm text-text-muted">
        O protótipo de conversa aparece quando a iniciativa tiver uma jornada ligada. Use &quot;Gerar jornada&quot; para criar o rascunho.
      </div>
    );
  }

  return (
    <div className="flex gap-4">
      <div className="mx-auto w-[260px] shrink-0 rounded-[28px] border-2 border-border bg-bg p-2 shadow-halo-purple">
        <div className="flex items-center gap-2 rounded-t-[20px] bg-surface-2 px-3 py-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/20 text-accent">
            <Bot className="h-4 w-4" strokeWidth={1.5} />
          </span>
          <div className="min-w-0">
            <div className="truncate text-xs font-semibold">{company}</div>
            <div className="text-[11px] text-text-muted">protótipo · dados fictícios</div>
          </div>
        </div>
        <div className="flex min-h-[260px] flex-col gap-2 rounded-b-[20px] bg-surface-1 p-3">
          {phase >= 1 && (
            <div className="ml-auto max-w-[85%] animate-fade-in rounded-2xl rounded-br-sm bg-accent/25 px-3 py-2 text-xs">
              {conv.user}
            </div>
          )}
          {phase === 2 && (
            <div className="flex w-14 animate-fade-in items-center justify-center gap-1 rounded-2xl rounded-bl-sm bg-surface-2 px-3 py-2" aria-label="Digitando">
              {[0, 1, 2].map((i) => (
                <span key={i} className="h-1.5 w-1.5 animate-pulse rounded-full bg-text-muted" style={{ animationDelay: `${i * 150}ms` }} />
              ))}
            </div>
          )}
          {phase >= 3 && (
            <div className="max-w-[90%] animate-fade-in rounded-2xl rounded-bl-sm bg-surface-2 px-3 py-2 text-xs">
              {maskPii(conv.reply)}
            </div>
          )}
        </div>
      </div>
      <div className="min-w-0 flex-1 text-sm">
        <div className="flex items-center gap-1.5 font-semibold">
          <Smartphone className="h-4 w-4 text-accent" strokeWidth={1.5} /> Protótipo de conversa
        </div>
        <p className="mt-1 text-text-muted">Persona: {conv.persona}</p>
        <div className="mt-3 text-xs font-medium text-text-muted">O que acontece por trás</div>
        <ol className="mt-1 space-y-1">
          {conv.steps.map((s, i) => (
            <li key={`${s}-${i}`} className={cx('flex items-center gap-2 text-xs transition-opacity', phase >= 2 ? 'opacity-100' : 'opacity-30')}>
              <span className="flex h-4 w-4 items-center justify-center rounded-full border border-border font-mono text-[10px]">{i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
