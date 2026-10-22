'use client';

// Nó do Studio (seção 14): 240 × 72, faixa na cor da categoria, ícone, nome,
// componente e versão em mono, selos de problema no canto.
import { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { AlertTriangle, CheckCircle2, OctagonX, Hammer } from 'lucide-react';
import { NODE_CATEGORIES, type JourneyNode } from '@cortex/schemas';
import { cx } from '@/components/ui';
import { iconForKind, kindLabel } from './icons';

export const NODE_W = 240;
export const NODE_H = 72;

export type StudioNodeData = StudioNodeDeco & { node: JourneyNode; [key: string]: unknown };

/** Decoração visual do nó (estado de teste, problemas, diff, construção). */
export interface StudioNodeDeco {
  componentName?: string;
  componentVersion?: string;
  problems: { severity: 'erro' | 'aviso'; message: string }[];
  run?: 'running' | 'done' | 'blocked';
  /** Muda a cada bloqueio para repetir o tremor. */
  shakeKey?: number;
  halo?: boolean;
  built?: boolean;
  diff?: 'added' | 'removed' | 'changed';
}

export type StudioFlowNode = Node<StudioNodeData, 'cortex'>;

function StudioNodeImpl({ data, selected }: NodeProps<StudioFlowNode>) {
  const n = data.node;
  const cat = NODE_CATEGORIES[n.category];
  const Icon = iconForKind(n.kind);
  const errors = data.problems.filter((p) => p.severity === 'erro');
  const warns = data.problems.filter((p) => p.severity === 'aviso');
  const outputs = n.outputs ?? [];
  const isTrigger = n.category === 'gatilho';
  const isEnd = n.kind === 'saida.encerrar';
  const blocked = data.run === 'blocked';

  return (
    <div
      key={data.shakeKey}
      style={{ width: NODE_W, height: NODE_H }}
      className={cx(
        'relative overflow-visible rounded-card border bg-surface-1 transition-[border-color,box-shadow,opacity] duration-200',
        'border-border',
        data.run === 'done' && 'border-primary/80',
        data.run === 'running' && 'animate-pulse-halo border-primary',
        data.built && !data.run && 'border-primary/80 shadow-halo-green',
        data.halo && 'shadow-halo-green border-primary',
        selected && !blocked && 'border-accent shadow-halo-purple',
        blocked && 'animate-shake border-danger shadow-halo-red',
        data.diff === 'added' && 'border-primary shadow-halo-green',
        data.diff === 'removed' && 'border-danger opacity-60 shadow-halo-red',
        data.diff === 'changed' && 'border-accent shadow-halo-purple',
      )}
    >
      <div className="absolute inset-x-0 top-0 h-1 rounded-t-card" style={{ background: cat.color }} aria-hidden />
      {!isTrigger && (
        <Handle type="target" position={Position.Left} className="!h-2.5 !w-2.5 !border-2 !border-surface-1 !bg-accent-soft" />
      )}
      <div className="flex h-full items-center gap-2.5 px-3 pt-1">
        <span
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border"
          style={{ color: cat.color, borderColor: `${cat.color}66`, background: `${cat.color}14` }}
        >
          {blocked ? <OctagonX className="h-4 w-4 text-danger" strokeWidth={1.5} /> : <Icon className="h-4 w-4" strokeWidth={1.5} />}
        </span>
        <div className="min-w-0 flex-1 pr-6">
          <div className="truncate text-[13px] font-medium leading-tight text-text">{n.label}</div>
          <div className="mt-0.5 truncate font-mono text-[11px] text-text-muted">
            {data.componentName ? `${data.componentName} ${data.componentVersion ? `v${data.componentVersion}` : ''}` : kindLabel(n.kind)}
          </div>
        </div>
      </div>

      {(errors.length > 0 || warns.length > 0) && (
        <span
          className={cx(
            'absolute -right-2 -top-2 inline-flex h-5 min-w-5 items-center justify-center gap-0.5 rounded-full border px-1 text-[10px] font-semibold',
            errors.length ? 'border-danger bg-danger text-on-primary' : 'border-warning bg-warning text-on-primary',
          )}
          title={data.problems.map((p) => p.message).join('\n')}
          aria-label={`${errors.length} erro(s), ${warns.length} aviso(s)`}
        >
          {errors.length ? <OctagonX className="h-3 w-3" strokeWidth={2} /> : <AlertTriangle className="h-3 w-3" strokeWidth={2} />}
          {errors.length + warns.length}
        </span>
      )}

      {data.built && (
        <span className="absolute -bottom-2 right-2 inline-flex items-center gap-1 rounded-full border border-primary/60 bg-bg px-1.5 py-px text-[10px] font-medium text-primary">
          <Hammer className="h-2.5 w-2.5" strokeWidth={2} /> construído
        </span>
      )}
      {data.run === 'done' && !data.built && (
        <CheckCircle2 className="absolute -bottom-1.5 right-2 h-3.5 w-3.5 rounded-full bg-bg text-primary" strokeWidth={2} aria-label="executado" />
      )}

      {!isEnd &&
        (outputs.length ? (
          outputs.map((o, i) => {
            const top = `${((i + 1) / (outputs.length + 1)) * 100}%`;
            return (
              <div key={o}>
                <Handle
                  id={o}
                  type="source"
                  position={Position.Right}
                  style={{ top }}
                  className="!h-2.5 !w-2.5 !border-2 !border-surface-1 !bg-primary"
                />
                <span
                  className="pointer-events-none absolute left-full ml-2 -translate-y-1/2 whitespace-nowrap rounded bg-bg/80 px-1 text-[10px] text-text-muted"
                  style={{ top }}
                >
                  {o}
                </span>
              </div>
            );
          })
        ) : (
          <Handle type="source" position={Position.Right} className="!h-2.5 !w-2.5 !border-2 !border-surface-1 !bg-primary" />
        ))}
    </div>
  );
}

export const StudioNode = memo(StudioNodeImpl);
