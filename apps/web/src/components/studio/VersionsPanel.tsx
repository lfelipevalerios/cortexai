'use client';

// Aba Versões: histórico, comparação visual entre duas versões, releases e rollback.
import { useState } from 'react';
import { GitCompare, Undo2 } from 'lucide-react';
import { ENV_ORDER, type EnvId, type Journey, type Release } from '@cortex/schemas';
import { Button, EnvBadge, Mono, StatusChip, cx } from '@/components/ui';
import { compareVersions, formatDateTime, RELEASE_STATUS } from './lib';

export function VersionsPanel({
  journey, releases, onCompare, onRollback, canRollback,
}: {
  journey: Journey;
  releases: Release[];
  onCompare: (a: string, b: string) => void;
  onRollback: (env: EnvId, to: string) => void;
  canRollback: (env: EnvId) => boolean;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const versions = [...journey.versions].sort((a, b) => compareVersions(b.version, a.version));
  const toggle = (v: string) =>
    setPicked((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v].slice(-2)));

  const rollbackTargets = ENV_ORDER.flatMap((env) => {
    const cur = journey.envVersions[env];
    if (!cur) return [];
    const prev = versions.find((v) => compareVersions(v.version, cur) < 0);
    return prev ? [{ env, cur, prev: prev.version }] : [];
  });

  return (
    <div className="flex h-full min-h-0 gap-3">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-text-muted">Selecione duas versões para ver o diff no canvas: verde adicionado, vermelho removido, roxo alterado.</span>
          <Button
            size="sm"
            variant="secondary"
            icon={GitCompare}
            disabled={picked.length !== 2}
            onClick={() => {
              const [a, b] = [...picked].sort(compareVersions);
              onCompare(a, b);
            }}
          >
            Comparar selecionadas
          </Button>
        </div>
        <ul className="min-h-0 flex-1 space-y-1 overflow-auto">
          {versions.map((v) => {
            const envs = ENV_ORDER.filter((e) => journey.envVersions[e] === v.version);
            const on = picked.includes(v.version);
            return (
              <li key={v.version}>
                <label className={cx('flex cursor-pointer items-start gap-3 rounded-field border px-3 py-2', on ? 'border-accent bg-accent/5' : 'border-border hover:bg-surface-2')}>
                  <input type="checkbox" checked={on} onChange={() => toggle(v.version)} className="mt-1 accent-[#A07EFC]" aria-label={`Selecionar versão ${v.version}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Mono className="text-sm font-medium">v{v.version}</Mono>
                      {envs.map((e) => <EnvBadge key={e} env={e} />)}
                      <span className="text-xs text-text-muted">{v.author} · {formatDateTime(v.createdAt)} · {v.graph.nodes.length} nós</span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-text-muted">{v.note}</p>
                  </div>
                </label>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="flex w-[320px] shrink-0 flex-col gap-2">
        <div className="rounded-field border border-border bg-bg/40 p-3">
          <div className="mb-2 text-xs font-semibold">Rollback em um clique</div>
          {rollbackTargets.length === 0 && <p className="text-xs text-text-muted">Nenhum ambiente com versão anterior para voltar.</p>}
          <ul className="space-y-1.5">
            {rollbackTargets.map((t) => (
              <li key={t.env} className="flex items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-1.5">
                  <EnvBadge env={t.env} /> <Mono>v{t.cur}</Mono> → <Mono>v{t.prev}</Mono>
                </span>
                <Button size="sm" variant="tertiary" icon={Undo2} disabled={!canRollback(t.env)} onClick={() => onRollback(t.env, t.prev)}>
                  Rollback
                </Button>
              </li>
            ))}
          </ul>
        </div>
        <div className="min-h-0 flex-1 overflow-auto rounded-field border border-border bg-bg/40 p-3">
          <div className="mb-2 text-xs font-semibold">Releases</div>
          {releases.length === 0 && <p className="text-xs text-text-muted">Nenhuma promoção registrada.</p>}
          <ul className="space-y-1.5">
            {releases.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-1.5 text-xs">
                <EnvBadge env={r.from} />→<EnvBadge env={r.to} />
                <Mono>v{r.version}</Mono>
                <StatusChip status={RELEASE_STATUS[r.status]} label={r.status === 'promovida' ? 'Promovida' : r.status === 'bloqueada' ? 'Bloqueada' : 'Rollback'} />
                {r.trafficPct !== undefined && <span className="text-text-muted">{r.trafficPct}% do tráfego</span>}
                <span className="text-text-muted">{formatDateTime(r.at)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
