'use client';

import { useEffect } from 'react';
import { useCortex } from '@/lib/store';

/** Carrega o estado salvo no navegador antes de desenhar a aplicação. */
export function Hydrate({ children }: { children: React.ReactNode }) {
  const hydrated = useCortex((s) => s.hydrated);
  useEffect(() => {
    useCortex.persist.rehydrate();
  }, []);
  if (!hydrated) return <div className="flex h-screen items-center justify-center text-sm text-text-muted">Carregando o Córtex…</div>;
  return <>{children}</>;
}
