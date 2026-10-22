'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Plus } from 'lucide-react';
import { useCortex } from '@/lib/store';
import { Logo } from '@/components/Logo';
import { Button, Field, Input, Modal } from '@/components/ui';

export default function WorkspacesPage() {
  const workspaces = useCortex((s) => s.workspaces);
  const setActive = useCortex((s) => s.setActive);
  const addWorkspace = useCortex((s) => s.addWorkspace);
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [segment, setSegment] = useState('');

  const open = (id: string) => {
    setActive(id);
    router.push('/cerebro/');
  };

  const create = () => {
    if (!name.trim()) return;
    const id = addWorkspace(name.trim(), segment.trim() || 'Sem segmento');
    setCreating(false);
    setName('');
    setSegment('');
    open(id);
  };

  return (
    <main className="showcase-bg flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 py-16">
      <Logo size="lg" />
      <p className="mb-10 mt-3 max-w-md text-center text-sm text-text-muted">Escolha o workspace. Cada um tem o seu cérebro.</p>
      <div className="grid w-full max-w-5xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {workspaces.map((w) => {
          const journeys = w.brain.fronts.reduce((n, f) => n + f.journeys.length, 0);
          return (
            <button
              key={w.id}
              onClick={() => open(w.id)}
              className="group flex flex-col rounded-card border border-border bg-surface-1/80 p-5 text-left backdrop-blur transition-all duration-200 hover:border-primary/60 hover:shadow-halo-green"
            >
              <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-full border border-accent/50 bg-accent/10 text-base font-semibold text-accent group-hover:border-primary/60 group-hover:text-primary">
                {w.name.slice(0, 1)}
              </span>
              <span className="text-xs text-accent-soft">{w.segment}</span>
              <span className="text-lg font-semibold">{w.name}</span>
              <span className="mt-1 flex-1 text-xs text-text-muted">{w.tagline}</span>
              <span className="mt-4 text-xs text-text-muted">
                {w.brain.fronts.length} {w.brain.fronts.length === 1 ? 'frente' : 'frentes'} · {journeys} {journeys === 1 ? 'jornada' : 'jornadas'}
              </span>
              <span className="mt-3 flex items-center gap-1 text-xs font-medium text-primary opacity-70 group-hover:opacity-100">
                Abrir o cérebro <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </button>
          );
        })}
        <button
          onClick={() => setCreating(true)}
          className="flex min-h-[220px] flex-col items-center justify-center gap-2 rounded-card border border-dashed border-border text-sm text-text-muted transition-colors hover:border-primary/60 hover:text-primary"
        >
          <Plus className="h-6 w-6" strokeWidth={1.5} />
          Novo workspace
        </button>
      </div>

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Novo workspace"
        footer={<><Button variant="ghost" onClick={() => setCreating(false)}>Cancelar</Button><Button variant="primary" onClick={create} disabled={!name.trim()}>Criar</Button></>}
      >
        <Field label="Nome da empresa">
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()} />
        </Field>
        <Field label="Segmento">
          <Input value={segment} onChange={(e) => setSegment(e.target.value)} placeholder="Ex.: Saúde, Varejo" onKeyDown={(e) => e.key === 'Enter' && create()} />
        </Field>
      </Modal>
    </main>
  );
}
