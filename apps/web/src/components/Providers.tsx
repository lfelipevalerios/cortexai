'use client';

import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setAuthor, useAuthor } from '@/lib/author';
import { Button, Field, Input, Modal } from './ui';

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: true } } }),
  );
  return (
    <QueryClientProvider client={client}>
      {children}
      <AuthorGate />
    </QueryClientProvider>
  );
}

/** Pede o nome de quem edita na primeira visita; ele assina cada versão. */
function AuthorGate() {
  const author = useAuthor();
  const [name, setName] = useState('');
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || author) return null;
  const save = () => name.trim() && setAuthor(name);
  return (
    <Modal open onClose={() => undefined} title="Como você se chama?" footer={<Button variant="primary" onClick={save} disabled={!name.trim()}>Continuar</Button>}>
      <p className="text-sm text-text-muted">O seu nome fica registrado em cada versão que você salvar no cérebro.</p>
      <Field label="Nome">
        <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} />
      </Field>
    </Modal>
  );
}
