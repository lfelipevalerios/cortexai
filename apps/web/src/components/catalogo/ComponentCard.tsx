'use client';

import { BadgeCheck, Sparkles, Star, Users } from 'lucide-react';
import { COMPONENT_TYPES, type Component, type EnvId } from '@cortex/schemas';
import { useWs } from '@/lib/store';
import { Chip, EnvBadge, Mono, StatusChip, cx } from '@/components/ui';
import { availableEnvs, TYPE_ICON } from './lib';

export function ComponentCard({ c, env, featured, tourTarget, onOpen }: { c: Component; env: EnvId; featured?: boolean; tourTarget?: boolean; onOpen: () => void }) {
  const ws = useWs();
  const Icon = TYPE_ICON[c.type];
  const domain = c.domainId ? ws.domains.find((d) => d.id === c.domainId)?.name : undefined;
  const envs = availableEnvs(c.status);
  const inEnv = envs.includes(env);
  const coe = [...c.approvals].reverse().find((a) => a.profile === 'coe' && a.decision === 'aprovado');
  const deps = c.type === 'pacote' ? c.dependencies.map((id) => ws.components.find((x) => x.id === id)).filter((x): x is Component => !!x) : [];
  const business = c.type === 'rule' || c.type === 'documento';
  return (
    <button
      data-tour={tourTarget ? 'catalogo-componente' : undefined}
      onClick={onOpen}
      className={cx(
        'group flex h-full flex-col rounded-card border bg-surface-1 p-4 text-left transition-colors hover:bg-surface-2',
        featured ? 'border-primary/50 shadow-halo-green' : 'border-border hover:border-accent',
        c.status === 'depreciado' && 'opacity-75',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={cx(
            'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border',
            business ? 'border-accent/50 bg-accent/10 text-accent shadow-[0_0_14px_rgba(160,126,252,.25)]' : 'border-primary/50 bg-primary/10 text-primary shadow-[0_0_14px_rgba(0,255,149,.2)]',
          )}
        >
          <Icon className="h-[18px] w-[18px]" strokeWidth={1.5} />
        </span>
        <div className="flex flex-wrap justify-end gap-1">
          {featured && <Chip tone="green" icon={Sparkles}>Recém-publicado</Chip>}
          <StatusChip status={c.status} />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-text-muted">
        <span>{COMPONENT_TYPES[c.type].label}{c.packageKind ? ` · ${c.packageKind === 'jornada' ? 'Jornada' : 'Esteira'}` : ''}</span>
        <Mono className="text-accent-soft">v{c.version}</Mono>
      </div>
      <div className="mt-1 text-sm font-semibold leading-snug">{c.name}</div>
      <p className="mt-1 line-clamp-2 text-xs text-text-muted">{c.description}</p>

      {deps.length > 0 && (
        <ul className="mt-2 space-y-0.5 rounded-field border border-border bg-surface-2 px-2 py-1.5">
          {deps.slice(0, 4).map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-2 text-[11px]">
              <span className="truncate">{d.name}</span>
              <Mono className="text-[11px] text-text-muted">{d.version}</Mono>
            </li>
          ))}
          {deps.length > 4 && <li className="text-[11px] text-text-muted">+{deps.length - 4} componentes</li>}
        </ul>
      )}

      <div className="mt-auto pt-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
          {domain && <span className="text-accent-soft">{domain}</span>}
          <span>{c.owner}</span>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2 text-xs">
          <span className="flex items-center gap-3 text-text-muted">
            <span className="inline-flex items-center gap-1" title="Consumidores"><Users className="h-3.5 w-3.5" />{c.consumers}</span>
            <span className="inline-flex items-center gap-1" title="Nota de avaliação"><Star className="h-3.5 w-3.5" />{c.rating > 0 ? c.rating.toFixed(1).replace('.', ',') : 'Nova'}</span>
          </span>
          <span className="flex gap-1">
            {envs.length === 0 ? <Chip tone="muted">Só no rascunho</Chip> : envs.map((e) => <EnvBadge key={e} env={e} className={cx(e !== env && 'opacity-50')} />)}
          </span>
        </div>
        {coe && (featured || c.type === 'rule') && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-text-muted">
            <BadgeCheck className="h-3.5 w-3.5 text-primary" /> Aprovado pelo CoE AI · {coe.by}
          </div>
        )}
        {!inEnv && envs.length > 0 && <div className="mt-1 text-[11px] text-warning">Ainda não disponível no ambiente ativo.</div>}
      </div>
    </button>
  );
}
