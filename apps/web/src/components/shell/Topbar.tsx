'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Search, Compass, Sparkles, ChevronDown, Eye, MonitorPlay, RotateCcw, Settings, Users, HelpCircle, ChevronRight, Presentation } from 'lucide-react';
import { ENVS, ENV_ORDER, INDUSTRIES, PROFILES, type EnvId, type ProfileId } from '@cortex/schemas';
import { useCortex, useWs } from '@/lib/store';
import { moduleForPath } from '@/lib/modules';
import { IconButton, cx, Modal } from '@/components/ui';
import { emitTourAction, useAutoAction } from '@/lib/tour-bus';

export function Topbar() {
  const ws = useWs();
  const pathname = usePathname();
  const mod = moduleForPath(pathname);
  const s = useCortex();
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    if (mod) s.pushRecent({ label: mod.label, href: pathname });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Piloto automático do capítulo 7: entrar como dono de negócio.
  useAutoAction('vercomo.dono-negocio', () => {
    s.setProfile('dono_negocio');
    emitTourAction('vercomo.dono-negocio');
  });

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-bg px-4">
      <WorkspaceMenu />
      <nav aria-label="Migalhas" className="hidden min-w-0 items-center gap-1 text-xs text-text-muted lg:flex">
        <ChevronRight className="h-3 w-3" />
        <span>{mod?.group ?? 'Início'}</span>
        {mod && (
          <>
            <ChevronRight className="h-3 w-3" />
            <Link href={mod.href} className="truncate text-text hover:underline">
              {mod.label}
            </Link>
          </>
        )}
        {mod && (
          <button onClick={() => setHelpOpen(true)} className="ml-1 rounded-full p-1 hover:bg-surface-2" aria-label={`Ajuda: ${mod.label}`} title="Sobre esta tela">
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        )}
      </nav>

      <div className="flex-1" />

      <button
        onClick={() => s.setPaletteOpen(true)}
        className="hidden h-9 w-64 items-center gap-2 rounded-full border border-border bg-surface-1 px-3 text-xs text-text-muted hover:border-accent md:flex"
      >
        <Search className="h-4 w-4" strokeWidth={1.5} />
        <span className="flex-1 text-left">Buscar objetos e ações</span>
        <kbd className="rounded border border-border px-1.5 font-mono text-[10px]">Ctrl K</kbd>
      </button>

      <EnvSwitch value={s.env} onChange={s.setEnv} />
      <ProfileMenu value={s.profile} onChange={(p) => { s.setProfile(p); emitTourAction(`vercomo.${p.replace('_', '-')}`); }} users={ws.users} />

      <button
        data-tour="tour-botao"
        onClick={() => s.setTour({ active: true, detached: false })}
        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-primary/50 px-3 text-xs font-medium text-primary hover:bg-primary/10"
      >
        <Compass className="h-4 w-4" strokeWidth={1.5} /> Tour
      </button>
      <IconButton icon={Sparkles} label="Pergunte ao Córtex" onClick={() => s.setAskOpen(true)} className="text-accent" />
      <UserMenu />

      <Modal open={helpOpen} onClose={() => setHelpOpen(false)} title={mod?.label ?? ''} subtitle="Ajuda contextual">
        <p className="text-sm text-text-muted">{mod?.help}</p>
      </Modal>
    </header>
  );
}

function useOutside(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && close();
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open, close]);
  return ref;
}

function WorkspaceMenu() {
  const s = useCortex();
  const router = useRouter();
  const ws = useWs();
  const [open, setOpen] = useState(false);
  const ref = useOutside(open, () => setOpen(false));
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 rounded-full border border-border bg-surface-1 py-1 pl-1 pr-3 hover:border-accent" aria-haspopup="menu">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/20 text-xs font-semibold text-accent">{ws.workspace.company.slice(0, 1)}</span>
        <span className="text-left leading-tight">
          <span className="block text-xs font-medium">{ws.workspace.company}</span>
          <span className="block text-[11px] text-text-muted">{INDUSTRIES[ws.workspace.industry].label}</span>
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-text-muted" />
      </button>
      {open && (
        <div role="menu" className="absolute left-0 top-11 z-50 w-72 animate-fade-in rounded-card border border-border bg-surface-1 p-1 shadow-2xl">
          {Object.values(s.workspaces).map((w) => (
            <button
              key={w.workspace.id}
              role="menuitem"
              onClick={() => {
                s.setWorkspace(w.workspace.id);
                setOpen(false);
              }}
              className={cx('flex w-full items-center gap-2 rounded-field px-3 py-2 text-left text-sm hover:bg-surface-2', w.workspace.id === ws.workspace.id && 'bg-surface-2')}
            >
              <span className="flex-1">
                <span className="block font-medium">{w.workspace.company}</span>
                <span className="block text-xs text-text-muted">{INDUSTRIES[w.workspace.industry].label} · {w.workspace.segment}</span>
              </span>
            </button>
          ))}
          <button onClick={() => router.push('/')} className="mt-1 w-full rounded-field border-t border-border px-3 py-2 text-left text-xs text-text-muted hover:text-text">
            Ver seleção de workspaces
          </button>
        </div>
      )}
    </div>
  );
}

function EnvSwitch({ value, onChange }: { value: EnvId; onChange: (e: EnvId) => void }) {
  return (
    <div role="radiogroup" aria-label="Ambiente" className="flex rounded-full border border-border bg-surface-1 p-0.5" data-tour="ambiente-seletor">
      {ENV_ORDER.map((e) => {
        const active = e === value;
        return (
          <button
            key={e}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(e)}
            className={cx('rounded-full px-3 py-1 font-mono text-xs font-medium transition-colors', !active && 'text-text-muted hover:text-text')}
            style={active ? { background: ENVS[e].color, color: '#0D0020' } : undefined}
            title={ENVS[e].purpose}
          >
            {ENVS[e].label}
          </button>
        );
      })}
    </div>
  );
}

function ProfileMenu({ value, onChange, users }: { value: ProfileId; onChange: (p: ProfileId) => void; users: { name: string; profile: ProfileId }[] }) {
  const [open, setOpen] = useState(false);
  const ref = useOutside(open, () => setOpen(false));
  return (
    <div ref={ref} className="relative" data-tour="ver-como">
      <button onClick={() => setOpen(!open)} className="flex h-9 items-center gap-1.5 rounded-full border border-border bg-surface-1 px-3 text-xs hover:border-accent" aria-haspopup="menu">
        <Eye className="h-4 w-4 text-accent" strokeWidth={1.5} />
        <span className="hidden text-text-muted xl:inline">Ver como</span>
        <span className="font-medium">{PROFILES[value].label}</span>
        <ChevronDown className="h-3.5 w-3.5 text-text-muted" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-11 z-50 w-80 animate-fade-in rounded-card border border-border bg-surface-1 p-1 shadow-2xl">
          {(Object.keys(PROFILES) as ProfileId[]).map((p) => {
            const u = users.find((x) => x.profile === p);
            return (
              <button
                key={p}
                role="menuitem"
                onClick={() => {
                  onChange(p);
                  setOpen(false);
                }}
                className={cx('w-full rounded-field px-3 py-2 text-left hover:bg-surface-2', p === value && 'bg-surface-2')}
              >
                <span className="block text-sm font-medium">{PROFILES[p].label}{u && <span className="font-normal text-text-muted"> · {u.name}</span>}</span>
                <span className="block text-xs text-text-muted">{PROFILES[p].does}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function UserMenu() {
  const s = useCortex();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useOutside(open, () => setOpen(false));
  const item = 'flex w-full items-center gap-2 rounded-field px-3 py-2 text-left text-sm hover:bg-surface-2';
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} aria-label="Menu do usuário" className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/25 text-xs font-semibold text-accent-soft">
        LF
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-11 z-50 w-64 animate-fade-in rounded-card border border-border bg-surface-1 p-1 shadow-2xl">
          <button className={item} onClick={() => { s.setPresentation(!s.presentation); setOpen(false); }}>
            <MonitorPlay className="h-4 w-4" strokeWidth={1.5} /> {s.presentation ? 'Sair do modo apresentação' : 'Modo apresentação'}
          </button>
          <button className={item} onClick={() => { s.setShowOffers(!s.showOffers); setOpen(false); }}>
            <Presentation className="h-4 w-4" strokeWidth={1.5} /> {s.showOffers ? 'Ocultar camada de ofertas' : 'Exibir camada de ofertas'}
          </button>
          <button
            className={item}
            onClick={() => {
              s.resetDemo();
              setOpen(false);
              s.toast({ kind: 'sucesso', title: 'Demo restaurada', description: 'Todos os workspaces voltaram ao estado inicial.' });
              router.push('/cockpit');
            }}
          >
            <RotateCcw className="h-4 w-4" strokeWidth={1.5} /> Restaurar demo
          </button>
          <div className="my-1 border-t border-border" />
          <button className={item} onClick={() => { s.toast({ kind: 'info', title: 'Configurações', description: 'Disponível na versão conectada (Entra ID, usuários e workspaces).' }); setOpen(false); }}>
            <Settings className="h-4 w-4" strokeWidth={1.5} /> Configurações
          </button>
          <button className={item} onClick={() => { s.toast({ kind: 'info', title: 'Acessos', description: 'Na demo, os perfis são simulados por "Ver como".' }); setOpen(false); }}>
            <Users className="h-4 w-4" strokeWidth={1.5} /> Acessos
          </button>
        </div>
      )}
    </div>
  );
}
