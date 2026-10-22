'use client';

import { useState } from 'react';
import type { KnowledgeDocument, WorkspaceData } from '@cortex/schemas';
import { PROFILES } from '@cortex/schemas';
import { relativeTime } from '@cortex/engine';
import { BookOpen, FolderOpen, Users, Scissors, Cpu, X } from 'lucide-react';
import { Card, Chip, Drawer, StatusChip, Table, Mono, Button, cx } from '@/components/ui';
import { demoNow } from '@/lib/store';

export function ColecoesTab({ ws, onOpenDoc }: { ws: WorkspaceData; onOpenDoc: (id: string) => void }) {
  const [filter, setFilter] = useState<string | null>(null);
  const userName = (id: string) => ws.users.find((u) => u.id === id || u.name === id)?.name ?? id;
  const docs = ws.documents.filter((d) => !filter || d.collectionId === filter);
  const colName = (id: string) => ws.collections.find((c) => c.id === id)?.name ?? id;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {ws.collections.map((c) => {
          const count = ws.documents.filter((d) => d.collectionId === c.id).length;
          const dom = ws.domains.find((d) => d.id === c.domainId);
          const active = filter === c.id;
          return (
            <button key={c.id} onClick={() => setFilter(active ? null : c.id)} className="text-left">
              <Card halo={active ? 'purple' : undefined} className={cx('h-full p-4 transition-colors hover:border-accent')}>
                <div className="flex items-start justify-between gap-2">
                  <FolderOpen className="h-5 w-5 text-accent" strokeWidth={1.5} />
                  <Chip tone="lilac">{c.theme}</Chip>
                </div>
                <div className="mt-2 text-sm font-semibold">{c.name}</div>
                <div className="mt-0.5 text-xs text-text-muted">
                  Dono {userName(c.owner)}{dom ? ` · domínio ${dom.name}` : ''}
                </div>
                <div className="mt-3 space-y-1 text-xs text-text-muted">
                  <div className="flex items-center gap-1.5"><Scissors className="h-3.5 w-3.5" strokeWidth={1.5} /> {c.chunking}</div>
                  <div className="flex items-center gap-1.5"><Cpu className="h-3.5 w-3.5" strokeWidth={1.5} /> <Mono>{c.embeddingModel}</Mono></div>
                  <div className="flex items-start gap-1.5">
                    <Users className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
                    <span>{c.profiles.map((p) => PROFILES[p].label).join(', ')}</span>
                  </div>
                </div>
                <div className="mt-3 text-sm"><span className="font-semibold text-primary">{count}</span> <span className="text-text-muted">documentos</span></div>
              </Card>
            </button>
          );
        })}
      </div>

      <div>
        <div className="mb-2 flex items-center gap-2">
          <h2 className="text-base font-semibold">Documentos</h2>
          {filter && (
            <Button size="sm" variant="ghost" icon={X} onClick={() => setFilter(null)}>
              {colName(filter)}
            </Button>
          )}
        </div>
        <Table<KnowledgeDocument>
          rows={docs}
          rowKey={(d) => d.id}
          onRowClick={(d) => onOpenDoc(d.id)}
          columns={[
            { key: 'title', header: 'Documento', render: (d) => <span className="flex items-center gap-2"><BookOpen className="h-4 w-4 text-text-muted" strokeWidth={1.5} />{d.title}</span> },
            { key: 'col', header: 'Coleção', render: (d) => <span className="text-text-muted">{colName(d.collectionId)}</span> },
            { key: 'v', header: 'Versão', render: (d) => <Mono>{d.version}</Mono> },
            { key: 'chunks', header: 'Trechos', render: (d) => d.chunks.length },
            { key: 'up', header: 'Atualizado', render: (d) => <span className="text-text-muted">{relativeTime(d.updatedAt, demoNow())}</span> },
            { key: 'st', header: 'Status', render: (d) => <StatusChip status={d.status} /> },
          ]}
        />
      </div>
    </div>
  );
}

export function DocDrawer({ ws, docId, onClose, highlight }: { ws: WorkspaceData; docId: string | null; onClose: () => void; highlight?: number }) {
  const doc = ws.documents.find((d) => d.id === docId);
  const col = ws.collections.find((c) => c.id === doc?.collectionId);
  return (
    <Drawer open={!!doc} onClose={onClose} width={560} title={doc?.title ?? ''} subtitle={doc ? `${col?.name ?? ''} · versão ${doc.version} · ${doc.chunks.length} trechos` : undefined}>
      {doc && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <StatusChip status={doc.status} />
            {col && <Chip tone="muted"><Mono>{col.embeddingModel}</Mono></Chip>}
            {col && <Chip tone="muted">{col.chunking}</Chip>}
          </div>
          <ol className="space-y-2">
            {doc.chunks.map((c, i) => (
              <li key={i} className={cx('rounded-field border px-3 py-2 text-sm', i === highlight ? 'border-primary/60 bg-primary/5' : 'border-border')}>
                <div className="mb-1 text-[11px] text-text-muted">Trecho {i + 1}</div>
                {c}
              </li>
            ))}
          </ol>
        </div>
      )}
    </Drawer>
  );
}
