'use client';

import { CloudOff, Loader2 } from 'lucide-react';
import { Button } from './ui';

export function Loading({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div className="flex h-full min-h-[200px] items-center justify-center gap-2 text-sm text-text-muted">
      <Loader2 className="h-4 w-4 animate-spin" /> {label}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-2 px-6 text-center">
      <CloudOff className="h-8 w-8 text-danger" strokeWidth={1.5} />
      <div className="text-sm font-semibold">Não foi possível carregar</div>
      <p className="max-w-sm text-sm text-text-muted">{error instanceof Error ? error.message : 'Erro desconhecido'}</p>
      <Button className="mt-2" onClick={onRetry}>
        Tentar de novo
      </Button>
    </div>
  );
}
