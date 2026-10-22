'use client';

import { ExternalLink, Pause, Play, Activity, Copy, Plug } from 'lucide-react';
import { ENV_ORDER, type Connector } from '@cortex/schemas';
import { CONNECTOR_TYPES } from '@cortex/seed';
import { formatNumber, relativeTime } from '@cortex/engine';
import { Button, EmptyState, EnvBadge, IconButton, Mono, StatusChip, Table, cx } from '@/components/ui';
import { demoNow, useWs } from '@/lib/store';
import { CATEGORY_ICON } from './helpers';

export interface RowActions {
  open: (c: Connector) => void;
  togglePause: (c: Connector) => void;
  test: (c: Connector) => void;
  duplicate: (c: Connector) => void;
}

export function MeusConectores({ actions, highlightId, canCreate, onNew }: { actions: RowActions; highlightId?: string | null; canCreate: boolean; onNew: () => void }) {
  const ws = useWs();
  const now = demoNow();
  return (
    <Table<Connector>
      rows={ws.connectors}
      rowKey={(c) => c.id}
      onRowClick={actions.open}
      empty={
        <EmptyState
          icon={Plug}
          title="Nenhum conector cadastrado"
          description="Conecte o primeiro sistema pela galeria; cada conector já nasce exposto como tool para agentes, com política de uso."
          action={canCreate ? <Button variant="primary" onClick={onNew}>Novo conector</Button> : undefined}
        />
      }
      columns={[
        {
          key: 'nome',
          header: 'Conector',
          render: (c) => {
            const t = CONNECTOR_TYPES.find((x) => x.id === c.typeId);
            const Icon = t ? CATEGORY_ICON[t.category] : Plug;
            return (
              <div className={cx('flex items-center gap-2.5', highlightId === c.id && 'rounded-field shadow-halo-green')}>
                <Icon className="h-4 w-4 shrink-0 text-accent" strokeWidth={1.5} />
                <div className="min-w-0">
                  <div className="truncate font-medium">{c.name}</div>
                  <Mono className="text-text-muted">{t?.name ?? c.typeId}</Mono>
                </div>
              </div>
            );
          },
        },
        { key: 'status', header: 'Status', render: (c) => <StatusChip status={c.status} /> },
        {
          key: 'envs',
          header: 'Ambientes',
          render: (c) => (
            <div className="flex gap-1">
              {ENV_ORDER.filter((e) => c.envs[e]).map((e) => <EnvBadge key={e} env={e} />)}
              {ENV_ORDER.every((e) => !c.envs[e]) && <span className="text-xs text-text-muted">sem credencial</span>}
            </div>
          ),
        },
        { key: 'sync', header: 'Última sincronização', render: (c) => <span className="text-text-muted">{relativeTime(c.lastSync, now) || '—'}</span> },
        { key: 'volume', header: 'Volume', className: 'text-right', render: (c) => <Mono>{formatNumber(c.volume)}</Mono> },
        {
          key: 'lat',
          header: 'Latência',
          className: 'text-right',
          render: (c) => <Mono className={c.latencyMs > 800 ? 'text-warning' : undefined}>{c.latencyMs ? `${formatNumber(c.latencyMs)} ms` : '—'}</Mono>,
        },
        { key: 'cons', header: 'Consumidores', className: 'text-right', render: (c) => <Mono>{c.consumers.length}</Mono> },
      ]}
      actions={(c) => (
        <span onClick={(e) => e.stopPropagation()} className="flex gap-0.5">
          <IconButton icon={ExternalLink} label="Abrir" onClick={() => actions.open(c)} />
          <IconButton icon={c.status === 'pausado' ? Play : Pause} label={c.status === 'pausado' ? 'Retomar' : 'Pausar'} onClick={() => actions.togglePause(c)} disabled={!canCreate || c.status === 'rascunho'} />
          <IconButton icon={Activity} label="Testar" onClick={() => actions.test(c)} disabled={c.status === 'rascunho'} />
          <IconButton icon={Copy} label="Duplicar para outro ambiente" onClick={() => actions.duplicate(c)} disabled={!canCreate} />
        </span>
      )}
    />
  );
}
