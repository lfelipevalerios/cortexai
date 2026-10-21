'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Lock } from 'lucide-react';
import { PROFILES } from '@cortex/schemas';
import { MODULES, GROUPS } from '@/lib/modules';
import { useCortex } from '@/lib/store';
import { cx } from '@/components/ui';

export function Sidebar() {
  const pathname = usePathname();
  const profile = useCortex((s) => s.profile);
  const allowed = PROFILES[profile].modules;

  return (
    <nav aria-label="Módulos" className="flex w-60 shrink-0 flex-col border-r border-border bg-bg">
      <Link href="/" className="flex items-center gap-2 px-5 py-4" title="Trocar de workspace">
        <span className="relative flex h-8 w-8 items-center justify-center rounded-full border border-primary/60 bg-primary/10 shadow-halo-green">
          <span className="h-2.5 w-2.5 rounded-full bg-primary" />
        </span>
        <span className="text-lg font-semibold tracking-tight">Córtex</span>
      </Link>
      <div className="min-h-0 flex-1 overflow-auto px-3 pb-4">
        {GROUPS.map((g) => (
          <div key={g} className="mt-3">
            <div className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-text-muted/80">{g}</div>
            {MODULES.filter((m) => m.group === g).map((m) => {
              const active = pathname === m.href || pathname.startsWith(m.href + '/');
              const locked = allowed !== 'all' && !allowed.includes(m.id);
              const Icon = m.icon;
              return (
                <Link
                  key={m.id}
                  href={m.href}
                  data-tour={`nav-${m.id}`}
                  className={cx(
                    'group flex items-center gap-2.5 rounded-field px-2 py-1.5 text-sm transition-colors',
                    active ? 'bg-surface-2 text-text shadow-[inset_2px_0_0_#00FF95]' : 'text-text-muted hover:bg-surface-1 hover:text-text',
                  )}
                >
                  <Icon className={cx('h-4 w-4', active && 'text-primary')} strokeWidth={1.5} />
                  <span className="flex-1 truncate">{m.label}</span>
                  {locked && <Lock className="h-3 w-3 opacity-60" aria-label="Somente leitura neste perfil" />}
                </Link>
              );
            })}
          </div>
        ))}
      </div>
      <div className="border-t border-border px-5 py-3 text-[11px] text-text-muted">Modo demonstração · dados sintéticos</div>
    </nav>
  );
}
