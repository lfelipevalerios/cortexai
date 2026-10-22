'use client';

// Paleta à esquerda: tipos de nó por categoria, com busca. Arrastar ou clicar cria o nó.
import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { NODE_CATEGORIES, NODE_KINDS, type NodeCategory, type NodeKindDef } from '@cortex/schemas';
import { cx } from '@/components/ui';
import { iconFor } from './icons';

export const DND_MIME = 'application/x-cortex-node-kind';

export function Palette({ editable, onAdd }: { editable: boolean; onAdd: (kind: NodeKindDef) => void }) {
  const [q, setQ] = useState('');
  const groups = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = term
      ? NODE_KINDS.filter((k) => k.label.toLowerCase().includes(term) || NODE_CATEGORIES[k.category].label.toLowerCase().includes(term))
      : NODE_KINDS;
    const map = new Map<NodeCategory, NodeKindDef[]>();
    for (const k of list) map.set(k.category, [...(map.get(k.category) ?? []), k]);
    return [...map.entries()];
  }, [q]);

  return (
    <aside aria-label="Paleta de nós" className="flex w-[216px] shrink-0 flex-col border-r border-border bg-surface-1">
      <div className="border-b border-border p-3">
        <div className="mb-2 text-sm font-semibold">Paleta</div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" strokeWidth={1.5} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar nó"
            aria-label="Buscar tipo de nó"
            className="w-full rounded-field border border-border bg-surface-2 py-1.5 pl-8 pr-2 text-xs placeholder:text-text-muted/70 focus:border-primary focus:outline-none"
          />
        </div>
        {!editable && <p className="mt-2 text-[11px] text-text-muted">Somente leitura: a paleta fica disponível ao editar em Dev.</p>}
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-2 py-2">
        {groups.length === 0 && <p className="px-2 py-4 text-xs text-text-muted">Nenhum tipo de nó com “{q}”.</p>}
        {groups.map(([cat, kinds]) => (
          <div key={cat} className="mb-3">
            <div className="mb-1 flex items-center gap-1.5 px-1 text-[11px] font-medium uppercase tracking-wide text-text-muted">
              <span className="h-2 w-2 rounded-full" style={{ background: NODE_CATEGORIES[cat].color }} aria-hidden />
              {NODE_CATEGORIES[cat].label}
            </div>
            <ul>
              {kinds.map((k) => {
                const Icon = iconFor(k.icon);
                return (
                  <li key={k.kind}>
                    <button
                      type="button"
                      disabled={!editable}
                      draggable={editable}
                      onDragStart={(e) => {
                        e.dataTransfer.setData(DND_MIME, k.kind);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onClick={() => onAdd(k)}
                      title={editable ? 'Arraste para o canvas ou clique para adicionar' : 'Edição indisponível'}
                      className={cx(
                        'flex w-full items-center gap-2 rounded-field px-2 py-1.5 text-left text-xs transition-colors',
                        editable ? 'cursor-grab hover:bg-surface-2 active:cursor-grabbing' : 'cursor-not-allowed opacity-50',
                      )}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: NODE_CATEGORIES[k.category].color }} strokeWidth={1.5} />
                      <span className="truncate">{k.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </aside>
  );
}
