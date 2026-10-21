'use client';

import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';
import { useCortex } from '@/lib/store';
import { cx } from '@/components/ui';

const ICON = { sucesso: CheckCircle2, aviso: AlertTriangle, erro: XCircle, info: Info };
const TONE = { sucesso: 'text-primary', aviso: 'text-warning', erro: 'text-danger', info: 'text-accent' };

export function Toaster() {
  const toasts = useCortex((s) => s.toasts);
  const dismiss = useCortex((s) => s.dismissToast);
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[90] flex w-[360px] max-w-[90vw] flex-col gap-2" aria-live="polite">
      {toasts.map((t) => {
        const Icon = ICON[t.kind];
        return (
          <div key={t.id} className="pointer-events-auto flex animate-fade-in items-start gap-3 rounded-card border border-border bg-surface-1 p-3 shadow-2xl">
            <Icon className={cx('mt-0.5 h-5 w-5 shrink-0', TONE[t.kind])} strokeWidth={1.5} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">{t.title}</div>
              {t.description && <div className="mt-0.5 text-xs text-text-muted">{t.description}</div>}
            </div>
            {t.undo && (
              <button
                className="text-xs font-medium text-primary hover:underline"
                onClick={() => {
                  t.undo?.();
                  dismiss(t.id);
                }}
              >
                Desfazer
              </button>
            )}
            <button onClick={() => dismiss(t.id)} aria-label="Fechar aviso" className="text-text-muted hover:text-text">
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
