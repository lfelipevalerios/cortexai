'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { ENVS, PROFILES } from '@cortex/schemas';
import { useCortex } from '@/lib/store';
import { moduleForPath } from '@/lib/modules';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { CommandPalette } from './CommandPalette';
import { AskCortex } from './AskCortex';
import { Toaster } from './Toaster';
import { WorkspacePicker } from './WorkspacePicker';
import { TourLayer } from '@/components/tour/TourLayer';
import { NoPermission, cx } from '@/components/ui';
import { Lock } from 'lucide-react';

export function AppShell({ children }: { children: React.ReactNode }) {
  const hydrated = useCortex((s) => s.hydrated);
  const wsId = useCortex((s) => s.activeWorkspaceId);
  const env = useCortex((s) => s.env);
  const presentation = useCortex((s) => s.presentation);
  const pathname = usePathname();

  useEffect(() => {
    useCortex.persist.rehydrate();
  }, []);

  useEffect(() => {
    document.body.classList.toggle('presentation', presentation);
  }, [presentation]);

  // Ctrl/⌘ + K abre a busca global.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        useCortex.getState().setPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  if (!hydrated) {
    return <div className="flex h-screen items-center justify-center text-sm text-text-muted">Carregando o Córtex…</div>;
  }

  const picking = pathname === '/' || !wsId;

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-[70] h-[3px] transition-colors duration-200" style={{ background: ENVS[env].color }} aria-hidden />
      {picking ? (
        <WorkspacePicker />
      ) : (
        <div className="flex h-screen overflow-hidden pt-[3px]">
          {!presentation && <Sidebar />}
          <div className="flex min-w-0 flex-1 flex-col">
            <Topbar />
            <main className={cx('min-h-0 flex-1 overflow-auto', presentation ? 'px-8 pb-20 pt-6' : 'px-6 pb-10 pt-5')}>
              <ModuleAccess />
              {children}
            </main>
          </div>
        </div>
      )}
      <CommandPalette />
      <AskCortex />
      <Toaster />
      <TourLayer />
    </>
  );
}

/** Perfil sem acesso ao módulo: a tela continua visível em leitura e explica quem pode. */
function ModuleAccess() {
  const pathname = usePathname();
  const profile = useCortex((s) => s.profile);
  const toast = useCortex((s) => s.toast);
  const mod = moduleForPath(pathname);
  if (!mod) return null;
  const allowed = PROFILES[profile].modules;
  if (allowed === 'all' || allowed.includes(mod.id)) return null;
  const who = (Object.keys(PROFILES) as (keyof typeof PROFILES)[])
    .filter((p) => {
      const m = PROFILES[p].modules;
      return m === 'all' || m.includes(mod.id);
    })
    .map((p) => PROFILES[p].label)
    .join(', ');
  return (
    <div className="mb-4 flex items-center gap-3 rounded-card border border-warning/40 bg-warning/5 px-4 py-3 text-sm">
      <Lock className="h-4 w-4 shrink-0 text-warning" strokeWidth={1.5} />
      <span className="flex-1">
        <b className="font-medium">{PROFILES[profile].label}</b> vê esta área só para leitura. Quem trabalha aqui: {who}.
      </span>
      <button
        className="rounded-full border border-border px-3 py-1 text-xs hover:border-accent"
        onClick={() => toast({ kind: 'info', title: 'Pedido de acesso enviado', description: 'A solicitação entrou na fila de aprovações.' })}
      >
        Solicitar acesso
      </button>
    </div>
  );
}

export { NoPermission };
