'use client';

import { useRouter } from 'next/navigation';
import { HeartPulse, ShoppingBag, Landmark, RadioTower, ArrowRight, type LucideIcon } from 'lucide-react';
import { INDUSTRIES, type IndustryId } from '@cortex/schemas';
import { useCortex } from '@/lib/store';
import { emitTourAction, useAutoAction } from '@/lib/tour-bus';
import { Chip } from '@/components/ui';

const ICONS: Record<IndustryId, LucideIcon> = { saude: HeartPulse, varejo: ShoppingBag, financeiro: Landmark, telecom: RadioTower };

export function WorkspacePicker() {
  const workspaces = useCortex((s) => s.workspaces);
  const activeId = useCortex((s) => s.activeWorkspaceId);
  const setWorkspace = useCortex((s) => s.setWorkspace);
  const router = useRouter();

  const choose = (id: string) => {
    setWorkspace(id);
    emitTourAction('ws.escolher-anchor');
    router.push('/cockpit');
  };

  // Piloto automático: mantém o workspace escolhido; sem escolha, usa telecom.
  useAutoAction('ws.escolher-anchor', () => choose(activeId ?? 'ws-telecom'));

  const list = Object.values(workspaces);

  return (
    <div className="showcase-bg flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 py-16">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-10 w-10 items-center justify-center rounded-full border border-primary/60 bg-primary/10 shadow-halo-green">
          <span className="h-3 w-3 rounded-full bg-primary" />
        </span>
        <span className="text-3xl font-semibold tracking-tight">Córtex</span>
      </div>
      <p className="mb-10 max-w-xl text-center text-sm text-text-muted">
        O cérebro agêntico da sua empresa: conecta o ecossistema, organiza dados e conhecimento, cria jornadas e as governa de Dev a Produção.
      </p>
      <div data-tour="ws-cards" className="grid w-full max-w-5xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {list.map((w) => {
          const Icon = ICONS[w.workspace.industry];
          return (
            <button
              key={w.workspace.id}
              onClick={() => choose(w.workspace.id)}
              className="group flex flex-col rounded-card border border-border bg-surface-1/80 p-5 text-left backdrop-blur transition-all duration-200 hover:border-primary/60 hover:shadow-halo-green"
            >
              <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-accent/50 bg-accent/10 text-accent shadow-[0_0_18px_rgba(160,126,252,.3)] group-hover:border-primary/60 group-hover:text-primary">
                <Icon className="h-6 w-6" strokeWidth={1.5} />
              </span>
              <Chip tone="purple" className="mb-2 self-start">{INDUSTRIES[w.workspace.industry].label}</Chip>
              <span className="text-lg font-semibold">{w.workspace.company}</span>
              <span className="mt-1 flex-1 text-xs text-text-muted">{w.workspace.tagline}</span>
              <span className="mt-5 flex items-center gap-1 text-xs font-medium text-primary opacity-70 group-hover:opacity-100">
                Entrar no workspace <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </button>
          );
        })}
        {list.length === 0 && <div className="col-span-full text-center text-sm text-text-muted">Gerando os workspaces de demonstração…</div>}
      </div>
      <p className="mt-10 text-xs text-text-muted">Todos os dados são sintéticos e identificados como dados de demonstração.</p>
    </div>
  );
}
