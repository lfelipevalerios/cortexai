'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { FileText, Paperclip, Plus, type LucideIcon } from 'lucide-react';
import type { NodeContent } from '@cortex/schemas';
import { cx } from '@/components/ui';

export type Tone = 'green' | 'purple' | 'lilac';

const TONE: Record<Tone, { ring: string; icon: string; line: string; halo: string; hover: string }> = {
  green: { ring: 'border-primary/50', icon: 'border-primary/50 bg-primary/10 text-primary', line: '#00FF95', halo: 'shadow-halo-green', hover: 'hover:shadow-halo-green' },
  purple: { ring: 'border-accent/60', icon: 'border-accent/50 bg-accent/10 text-accent', line: '#A07EFC', halo: 'shadow-halo-purple', hover: 'hover:shadow-halo-purple' },
  lilac: { ring: 'border-accent-soft/50', icon: 'border-accent-soft/40 bg-accent-soft/10 text-accent-soft', line: '#CFC4F2', halo: 'shadow-halo-purple', hover: 'hover:shadow-halo-purple' },
};

export interface OrbitItem {
  key: string;
  node: ReactNode;
  tone: Tone;
  /** Ângulo em graus (0 = direita, -90 = topo). Sem ângulo, os itens se distribuem pelo círculo. */
  angle?: number;
}

/** Desenha o nó central e os itens em órbita, ligados por linhas. */
export function Orbit({ center, items }: { center: ReactNode; items: OrbitItem[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setSize({ w: r.width, h: r.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  const narrow = size.w > 0 && size.w < 720;
  const cx0 = size.w / 2;
  const cy0 = size.h / 2;
  const rx = Math.min(size.w / 2 - 130, 430);
  const ry = Math.min(size.h / 2 - 70, 270);
  const pos = items.map((it, i) => {
    const a = ((it.angle ?? -90 + (360 / Math.max(items.length, 1)) * i) * Math.PI) / 180;
    return { x: cx0 + rx * Math.cos(a), y: cy0 + ry * Math.sin(a) };
  });

  return (
    <div ref={ref} className="relative h-full w-full overflow-auto">
      {narrow ? (
        <div className="flex flex-col items-center gap-3 p-4">
          {center}
          {items.map((it) => (
            <div key={it.key} className="w-full max-w-xs">{it.node}</div>
          ))}
        </div>
      ) : (
        size.w > 0 && (
          <>
            <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
              {items.map((it, i) => (
                <line key={it.key} x1={cx0} y1={cy0} x2={pos[i].x} y2={pos[i].y} stroke={TONE[it.tone].line} strokeOpacity={0.45} strokeWidth={1.5} className="orbit-line" />
              ))}
            </svg>
            <div className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: cx0, top: cy0 }}>
              {center}
            </div>
            {items.map((it, i) => (
              <div key={it.key} className="absolute w-[220px] -translate-x-1/2 -translate-y-1/2" style={{ left: pos[i].x, top: pos[i].y }}>
                <div className="animate-fade-in">{it.node}</div>
              </div>
            ))}
          </>
        )
      )}
    </div>
  );
}

/** Mostra se o nó já tem texto e arquivos. */
export function ContentBadges({ content }: { content: NodeContent }) {
  const hasText = content.text.trim().length > 0;
  if (!hasText && content.files.length === 0) return <span className="text-[11px] text-text-muted/70">vazio</span>;
  return (
    <span className="flex items-center gap-2 text-[11px] text-text-muted">
      {hasText && (
        <span className="flex items-center gap-1">
          <FileText className="h-3 w-3" /> texto
        </span>
      )}
      {content.files.length > 0 && (
        <span className="flex items-center gap-1">
          <Paperclip className="h-3 w-3" /> {content.files.length}
        </span>
      )}
    </span>
  );
}

export function CenterNode({ icon: Icon, label, title, subtitle, tone, content, active, onClick }: {
  icon: LucideIcon; label: string; title: string; subtitle?: string; tone: Tone; content: NodeContent; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cx(
        'flex h-[200px] w-[200px] flex-col items-center justify-center rounded-full border-2 bg-surface-1 px-5 text-center transition-all duration-200',
        TONE[tone].ring,
        TONE[tone].halo,
        active && 'ring-2 ring-primary ring-offset-4 ring-offset-bg',
      )}
      title="Abrir conteúdo"
    >
      <span className={cx('mb-2 flex h-10 w-10 items-center justify-center rounded-full border', TONE[tone].icon)}>
        <Icon className="h-5 w-5" strokeWidth={1.5} />
      </span>
      <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">{label}</span>
      <span className="line-clamp-2 text-base font-semibold leading-tight">{title}</span>
      {subtitle && <span className="mt-0.5 line-clamp-1 text-[11px] text-text-muted">{subtitle}</span>}
      <span className="mt-2">
        <ContentBadges content={content} />
      </span>
    </button>
  );
}

export function OrbitNode({ icon: Icon, label, title, subtitle, tone, content, active, onClick }: {
  icon: LucideIcon; label: string; title: string; subtitle?: string; tone: Tone; content?: NodeContent; active?: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cx(
        'flex w-full items-start gap-3 rounded-card border bg-surface-1/95 px-3 py-3 text-left backdrop-blur transition-all duration-200 hover:-translate-y-0.5',
        TONE[tone].ring,
        active ? TONE[tone].halo : TONE[tone].hover,
        active && 'ring-2 ring-primary',
      )}
    >
      <span className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-full border', TONE[tone].icon)}>
        <Icon className="h-[18px] w-[18px]" strokeWidth={1.5} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-medium uppercase tracking-wider text-text-muted">{label}</span>
        <span className="block truncate text-sm font-semibold">{title}</span>
        {subtitle && <span className="block truncate text-xs text-text-muted">{subtitle}</span>}
        {content && (
          <span className="mt-1 block">
            <ContentBadges content={content} />
          </span>
        )}
      </span>
    </button>
  );
}

export function AddNode({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-center gap-2 rounded-card border border-dashed border-border bg-bg/60 px-3 py-4 text-sm text-text-muted transition-colors hover:border-primary/60 hover:text-primary"
    >
      <Plus className="h-4 w-4" strokeWidth={1.5} /> {label}
    </button>
  );
}
