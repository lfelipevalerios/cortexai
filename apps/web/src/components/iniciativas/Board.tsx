'use client';

import { Handshake, User } from 'lucide-react';
import type { Initiative, WorkspaceData } from '@cortex/schemas';
import { INITIATIVE_STAGES } from '@cortex/schemas';
import { formatBRL } from '@cortex/engine';
import { Chip, StatusChip, Table, cx } from '@/components/ui';
import { HEALTH, STAGE_LABEL, STAGE_OFFERS, TYPE_LABEL, domainName } from './shared';

function InitiativeCard({ ws, ini, onOpen, highlight }: { ws: WorkspaceData; ini: Initiative; onOpen: () => void; highlight: boolean }) {
  return (
    <button
      onClick={onOpen}
      className={cx(
        'w-full rounded-card border bg-surface-1 p-3 text-left transition-all duration-200 hover:border-accent focus-visible:border-accent',
        highlight ? 'border-primary/60 shadow-halo-green' : 'border-border',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <Chip tone="purple">{TYPE_LABEL[ini.type]}</Chip>
        <StatusChip status={HEALTH[ini.health].status} label={HEALTH[ini.health].label} />
      </div>
      <div className="mt-2 line-clamp-3 text-sm font-medium leading-snug">{ini.title}</div>
      <div className="mt-2 text-xs text-text-muted">{domainName(ws, ini.domainId)}</div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <span className="inline-flex min-w-0 items-center gap-1 truncate text-xs text-text-muted">
          <User className="h-3 w-3 shrink-0" strokeWidth={1.5} />
          <span className="truncate">{ini.owner}</span>
        </span>
        <span className="shrink-0 text-sm font-semibold text-primary">{ini.expectedValueBRL ? formatBRL(ini.expectedValueBRL).replace(',00', '') : '—'}</span>
      </div>
    </button>
  );
}

export function Kanban({ ws, items, onOpen, highlightId, showOffers }: {
  ws: WorkspaceData; items: Initiative[]; onOpen: (id: string) => void; highlightId: string | null; showOffers: boolean;
}) {
  return (
    <div className="grid min-w-[1100px] grid-cols-5 gap-3">
      {INITIATIVE_STAGES.map((s) => {
        const col = items.filter((i) => i.stage === s.id);
        const total = col.reduce((a, i) => a + i.expectedValueBRL, 0);
        return (
          <section key={s.id} aria-label={s.label} className="flex flex-col rounded-card border border-border bg-bg/60 p-2">
            <header className="px-1 pb-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">{s.label}</h2>
                <span className="rounded-full bg-surface-2 px-2 text-xs text-text-muted">{col.length}</span>
              </div>
              <div className="text-xs text-text-muted">{total ? `${formatBRL(total).replace(',00', '')} esperados` : 'Sem valor estimado'}</div>
              {showOffers && (
                <div className="mt-2 flex flex-wrap items-center gap-1 rounded-field border border-accent/30 bg-accent/5 px-2 py-1.5">
                  <Handshake className="h-3.5 w-3.5 text-accent" strokeWidth={1.5} />
                  {STAGE_OFFERS[s.id].map((o) => (
                    <Chip key={o} tone="lilac">{o}</Chip>
                  ))}
                </div>
              )}
            </header>
            <div className="flex flex-col gap-2">
              {col.map((ini) => (
                <InitiativeCard key={ini.id} ws={ws} ini={ini} onOpen={() => onOpen(ini.id)} highlight={highlightId === ini.id} />
              ))}
              {col.length === 0 && (
                <div className="rounded-card border border-dashed border-border px-3 py-6 text-center text-xs text-text-muted">
                  Nenhuma iniciativa em {s.label.toLowerCase()} com estes filtros.
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function InitiativeList({ ws, items, onOpen }: { ws: WorkspaceData; items: Initiative[]; onOpen: (id: string) => void }) {
  return (
    <Table
      rows={items}
      rowKey={(r) => r.id}
      onRowClick={(r) => onOpen(r.id)}
      columns={[
        { key: 't', header: 'Iniciativa', render: (r) => <span className="font-medium">{r.title}</span> },
        { key: 's', header: 'Estágio', render: (r) => <Chip tone="muted">{STAGE_LABEL[r.stage]}</Chip> },
        { key: 'ty', header: 'Tipo', render: (r) => <Chip tone="purple">{TYPE_LABEL[r.type]}</Chip> },
        { key: 'd', header: 'Domínio', render: (r) => domainName(ws, r.domainId) },
        { key: 'o', header: 'Dono', render: (r) => <span className="text-text-muted">{r.owner}</span> },
        { key: 'v', header: 'Valor esperado', className: 'text-right', render: (r) => <span className="font-semibold">{r.expectedValueBRL ? formatBRL(r.expectedValueBRL).replace(',00', '') : '—'}</span> },
        { key: 'h', header: 'Saúde', render: (r) => <StatusChip status={HEALTH[r.health].status} label={HEALTH[r.health].label} /> },
      ]}
    />
  );
}
