'use client';

// Design system do Córtex (seção 14). Telas usam só estes componentes e os tokens.
import { clsx } from 'clsx';
import {
  CheckCircle2, AlertTriangle, XCircle, Clock, PauseCircle, FileEdit, Lock, Loader2, X, Inbox,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState, type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { ENVS, PROFILES, type EnvId, type PermissionAction, PERMISSIONS, can } from '@cortex/schemas';
import { useCortex } from '@/lib/store';

export const cx = clsx;

// ---------- Botões ----------
type Variant = 'primary' | 'secondary' | 'tertiary' | 'ghost' | 'danger';

export function Button({
  variant = 'secondary', size = 'md', icon: Icon, loading, className, children, ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md'; icon?: LucideIcon; loading?: boolean }) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap',
        size === 'sm' ? 'h-8 px-3 text-xs' : 'h-10 px-4 text-sm',
        variant === 'primary' && 'bg-primary text-on-primary hover:bg-primary-soft',
        variant === 'secondary' && 'bg-accent text-white hover:bg-accent/85',
        variant === 'tertiary' && 'border border-border text-text hover:border-accent hover:bg-surface-2',
        variant === 'ghost' && 'text-text-muted hover:text-text hover:bg-surface-2',
        variant === 'danger' && 'bg-danger text-on-primary hover:bg-danger/85',
        className,
      )}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : Icon ? <Icon className="h-4 w-4" strokeWidth={1.5} /> : null}
      {children}
    </button>
  );
}

export function IconButton({ icon: Icon, label, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon; label: string }) {
  return (
    <button
      {...rest}
      aria-label={label}
      title={label}
      className={cx('inline-flex h-9 w-9 items-center justify-center rounded-full text-text-muted hover:bg-surface-2 hover:text-text', className)}
    >
      <Icon className="h-[18px] w-[18px]" strokeWidth={1.5} />
    </button>
  );
}

// ---------- Cartões e layout ----------
export function Card({ className, children, halo, ...rest }: React.HTMLAttributes<HTMLDivElement> & { halo?: 'green' | 'purple' | 'red' }) {
  return (
    <div
      {...rest}
      className={cx(
        'rounded-card border border-border bg-surface-1',
        halo === 'green' && 'shadow-halo-green border-primary/50',
        halo === 'purple' && 'shadow-halo-purple border-accent/60',
        halo === 'red' && 'shadow-halo-red border-danger/60',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, actions, icon: Icon }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; icon?: LucideIcon }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
      <div className="flex min-w-0 items-center gap-2">
        {Icon && <Icon className="h-4 w-4 shrink-0 text-accent" strokeWidth={1.5} />}
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{title}</div>
          {subtitle && <div className="truncate text-xs text-text-muted">{subtitle}</div>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, children }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold leading-tight">{title}</h1>
        {subtitle && <p className="mt-1 max-w-3xl text-sm text-text-muted">{subtitle}</p>}
        {children}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function IconCircle({ icon: Icon, tone = 'purple', size = 'md' }: { icon: LucideIcon; tone?: 'purple' | 'green' | 'yellow' | 'red' | 'muted'; size?: 'sm' | 'md' | 'lg' }) {
  const s = size === 'sm' ? 'h-8 w-8' : size === 'lg' ? 'h-12 w-12' : 'h-10 w-10';
  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-full border',
        s,
        tone === 'purple' && 'border-accent/50 bg-accent/10 text-accent shadow-[0_0_14px_rgba(160,126,252,.25)]',
        tone === 'green' && 'border-primary/50 bg-primary/10 text-primary shadow-[0_0_14px_rgba(0,255,149,.2)]',
        tone === 'yellow' && 'border-warning/50 bg-warning/10 text-warning',
        tone === 'red' && 'border-danger/50 bg-danger/10 text-danger',
        tone === 'muted' && 'border-border bg-surface-2 text-text-muted',
      )}
    >
      <Icon className={size === 'lg' ? 'h-6 w-6' : 'h-[18px] w-[18px]'} strokeWidth={1.5} />
    </span>
  );
}

// ---------- Chips e selos ----------
export type ChipTone = 'green' | 'purple' | 'yellow' | 'red' | 'muted' | 'lilac';

const toneClass: Record<ChipTone, string> = {
  green: 'border-primary/40 bg-primary/10 text-primary',
  purple: 'border-accent/40 bg-accent/10 text-accent',
  lilac: 'border-accent-soft/40 bg-accent-soft/10 text-accent-soft',
  yellow: 'border-warning/40 bg-warning/10 text-warning',
  red: 'border-danger/40 bg-danger/10 text-danger',
  muted: 'border-border bg-surface-2 text-text-muted',
};

export function Chip({ tone = 'muted', icon: Icon, children, className }: { tone?: ChipTone; icon?: LucideIcon; children: ReactNode; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium', toneClass[tone], className)}>
      {Icon && <Icon className="h-3 w-3" strokeWidth={2} />}
      {children}
    </span>
  );
}

const STATUS: Record<string, { tone: ChipTone; icon: LucideIcon; label: string }> = {
  conectado: { tone: 'green', icon: CheckCircle2, label: 'Conectado' },
  sincronizando: { tone: 'lilac', icon: Loader2, label: 'Sincronizando' },
  degradado: { tone: 'yellow', icon: AlertTriangle, label: 'Degradado' },
  erro: { tone: 'red', icon: XCircle, label: 'Com erro' },
  pausado: { tone: 'muted', icon: PauseCircle, label: 'Pausado' },
  rascunho: { tone: 'muted', icon: FileEdit, label: 'Rascunho' },
  em_revisao: { tone: 'yellow', icon: Clock, label: 'Em revisão' },
  homologado: { tone: 'purple', icon: CheckCircle2, label: 'Homologado' },
  publicado_prd: { tone: 'green', icon: CheckCircle2, label: 'Publicado em Prd' },
  publicado: { tone: 'green', icon: CheckCircle2, label: 'Publicado' },
  depreciado: { tone: 'muted', icon: AlertTriangle, label: 'Depreciado' },
  bloqueado: { tone: 'red', icon: Lock, label: 'Bloqueado' },
  pendente: { tone: 'yellow', icon: Clock, label: 'Pendente' },
  aprovado: { tone: 'green', icon: CheckCircle2, label: 'Aprovado' },
  reprovado: { tone: 'red', icon: XCircle, label: 'Reprovado' },
  ajuste: { tone: 'yellow', icon: FileEdit, label: 'Ajuste pedido' },
  ativo: { tone: 'green', icon: CheckCircle2, label: 'Ativo' },
  sucesso: { tone: 'green', icon: CheckCircle2, label: 'Sucesso' },
  transbordo: { tone: 'yellow', icon: AlertTriangle, label: 'Transbordo' },
  ok: { tone: 'green', icon: CheckCircle2, label: 'OK' },
  falha: { tone: 'red', icon: XCircle, label: 'Falha' },
  passou: { tone: 'green', icon: CheckCircle2, label: 'Passou' },
  falhou: { tone: 'red', icon: XCircle, label: 'Falhou' },
  processado: { tone: 'green', icon: CheckCircle2, label: 'Processado' },
  processando: { tone: 'lilac', icon: Loader2, label: 'Processando' },
  verde: { tone: 'green', icon: CheckCircle2, label: 'Favorável' },
  amarelo: { tone: 'yellow', icon: AlertTriangle, label: 'Atenção' },
  vermelho: { tone: 'red', icon: XCircle, label: 'Crítico' },
};

/** Chip de status: sempre ícone + texto, nunca só cor. */
export function StatusChip({ status, label }: { status: string; label?: string }) {
  const s = STATUS[status] ?? { tone: 'muted' as ChipTone, icon: Clock, label: status };
  return (
    <Chip tone={s.tone} icon={s.icon}>
      {label ?? s.label}
    </Chip>
  );
}

export function EnvBadge({ env, className }: { env: EnvId; className?: string }) {
  const c = ENVS[env].color;
  return (
    <span
      className={cx('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[11px] font-medium uppercase', className)}
      style={{ color: c, borderColor: `${c}66`, background: `${c}14` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
      {ENVS[env].label}
    </span>
  );
}

export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx('font-mono text-xs', className)}>{children}</span>;
}

// ---------- Campos ----------
export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-text-muted">{hint}</span>}
    </label>
  );
}

const fieldCls = 'w-full rounded-field border border-border bg-surface-2 px-3 py-2 text-sm text-text placeholder:text-text-muted/70 focus:border-primary focus:outline-none';

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(fieldCls, props.className)} />;
}
export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx(fieldCls, 'min-h-[80px]', props.className)} />;
}
export function Select({ options, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string; label: string }[] }) {
  return (
    <select {...props} className={cx(fieldCls, 'pr-8', props.className)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

// ---------- Abas ----------
export function Tabs<T extends string>({ tabs, value, onChange, className }: { tabs: { id: T; label: ReactNode }[]; value: T; onChange: (v: T) => void; className?: string }) {
  return (
    <div role="tablist" className={cx('flex gap-1 border-b border-border', className)}>
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={cx(
            '-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors',
            value === t.id ? 'border-primary text-text' : 'border-transparent text-text-muted hover:text-text',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ---------- Tabela ----------
export interface Column<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  className?: string;
}

export function Table<T>({ columns, rows, rowKey, onRowClick, actions, empty, dense }: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (r: T) => string;
  onRowClick?: (r: T) => void;
  actions?: (r: T) => ReactNode;
  empty?: ReactNode;
  dense?: boolean;
}) {
  if (rows.length === 0) return <>{empty ?? <EmptyState title="Nada por aqui ainda" description="Quando houver itens, eles aparecem nesta tabela." />}</>;
  return (
    <div className="overflow-auto rounded-card border border-border">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10 bg-surface-2">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={cx('whitespace-nowrap px-3 py-2 text-left text-xs font-medium text-text-muted', c.className)}>
                {c.header}
              </th>
            ))}
            {actions && <th className="w-1" />}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={rowKey(r)}
              onClick={onRowClick ? () => onRowClick(r) : undefined}
              className={cx('group border-t border-border bg-surface-1', onRowClick && 'cursor-pointer hover:bg-surface-2')}
            >
              {columns.map((c) => (
                <td key={c.key} className={cx('px-3 align-middle', dense ? 'py-1.5' : 'py-2.5', c.className)}>
                  {c.render(r)}
                </td>
              ))}
              {actions && (
                <td className="px-2 text-right opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                  <div className="flex justify-end gap-1">{actions(r)}</div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------- Gaveta (inspetor) e modal ----------
export function Drawer({ open, onClose, title, subtitle, children, width = 400, footer }: {
  open: boolean; onClose: () => void; title: ReactNode; subtitle?: ReactNode; children: ReactNode; width?: number; footer?: ReactNode;
}) {
  useEscape(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-bg/50" onClick={onClose}>
      <aside
        role="dialog"
        aria-label={typeof title === 'string' ? title : undefined}
        style={{ width }}
        onClick={(e) => e.stopPropagation()}
        className="flex h-full max-w-full animate-fade-in flex-col border-l border-border bg-surface-1"
      >
        <div className="flex items-start justify-between gap-2 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <div className="text-base font-semibold">{title}</div>
            {subtitle && <div className="mt-0.5 text-xs text-text-muted">{subtitle}</div>}
          </div>
          <IconButton icon={X} label="Fechar" onClick={onClose} />
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-5 py-4">{children}</div>
        {footer && <div className="border-t border-border px-5 py-3">{footer}</div>}
      </aside>
    </div>
  );
}

export function Modal({ open, onClose, title, subtitle, children, footer, width = 560 }: {
  open: boolean; onClose: () => void; title: ReactNode; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode; width?: number;
}) {
  useEscape(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/70 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        style={{ width }}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] max-w-full animate-fade-in overflow-hidden rounded-card border border-border bg-surface-1 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-2 border-b border-border px-5 py-4">
          <div>
            <div className="text-base font-semibold">{title}</div>
            {subtitle && <div className="mt-0.5 text-xs text-text-muted">{subtitle}</div>}
          </div>
          <IconButton icon={X} label="Fechar" onClick={onClose} />
        </div>
        <div className="max-h-[65vh] overflow-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-border px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
}

// ---------- Estados de tela (seção 15) ----------
export function EmptyState({ title, description, action, icon: Icon = Inbox }: { title: string; description: string; action?: ReactNode; icon?: LucideIcon }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-card border border-dashed border-border px-6 py-10 text-center">
      <Icon className="mb-3 h-10 w-10 text-text-muted" strokeWidth={1} />
      <div className="text-sm font-semibold">{title}</div>
      <p className="mt-1 max-w-sm text-sm text-text-muted">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse rounded-field bg-surface-2', className)} />;
}

export function ErrorState({ cause, onRetry }: { cause: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center rounded-card border border-danger/40 bg-danger/5 px-6 py-8 text-center">
      <XCircle className="mb-2 h-8 w-8 text-danger" strokeWidth={1.5} />
      <div className="text-sm font-semibold">Algo não carregou</div>
      <p className="mt-1 text-sm text-text-muted">{cause}</p>
      {onRetry && <Button variant="tertiary" size="sm" className="mt-3" onClick={onRetry}>Tentar de novo</Button>}
    </div>
  );
}

/** Sem permissão: a tela não some, explica quem pode e oferece "Solicitar acesso". */
export function NoPermission({ action }: { action: PermissionAction }) {
  const toast = useCortex((s) => s.toast);
  const who = PERMISSIONS[action].profiles.map((p) => PROFILES[p].label).join(' ou ');
  return (
    <div className="flex items-start gap-3 rounded-card border border-warning/40 bg-warning/5 p-4">
      <Lock className="mt-0.5 h-5 w-5 shrink-0 text-warning" strokeWidth={1.5} />
      <div className="flex-1">
        <div className="text-sm font-semibold">{PERMISSIONS[action].label}: sem permissão neste perfil</div>
        <p className="mt-0.5 text-sm text-text-muted">Quem pode: {who}{PERMISSIONS[action].envs ? ` (somente em ${PERMISSIONS[action].envs!.map((e) => ENVS[e].label).join(', ')})` : ''}.</p>
      </div>
      <Button size="sm" variant="tertiary" onClick={() => toast({ kind: 'info', title: 'Pedido de acesso enviado', description: 'A solicitação entrou na fila de aprovações.' })}>
        Solicitar acesso
      </Button>
    </div>
  );
}

/** Permissão do perfil ativo no ambiente ativo. */
export function useCan(action: PermissionAction): boolean {
  const profile = useCortex((s) => s.profile);
  const env = useCortex((s) => s.env);
  return can(profile, action, env);
}

// ---------- Números ----------
export function KpiNumber({ value, label, delta, tone = 'green' }: { value: ReactNode; label: string; delta?: ReactNode; tone?: 'green' | 'purple' | 'text' }) {
  return (
    <div>
      <div className={cx('text-[32px] font-semibold leading-none', tone === 'green' && 'text-primary', tone === 'purple' && 'text-accent', tone === 'text' && 'text-text')}>{value}</div>
      <div className="mt-1.5 text-xs text-text-muted">{label}</div>
      {delta && <div className="mt-1 text-xs">{delta}</div>}
    </div>
  );
}

export function Progress({ value, tone = 'green' }: { value: number; tone?: 'green' | 'purple' | 'yellow' }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div
        className={cx('h-full rounded-full transition-all duration-200', tone === 'green' && 'bg-primary', tone === 'purple' && 'bg-accent', tone === 'yellow' && 'bg-warning')}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

// ---------- Código ----------
export function CodeBlock({ code, className, maxHeight = 420 }: { code: string; className?: string; maxHeight?: number }) {
  const toast = useCortex((s) => s.toast);
  return (
    <div className={cx('relative rounded-field border border-border bg-bg', className)}>
      <button
        className="absolute right-2 top-2 rounded-full border border-border bg-surface-1 px-2 py-0.5 text-[11px] text-text-muted hover:text-text"
        onClick={() => {
          navigator.clipboard?.writeText(code).catch(() => undefined);
          toast({ kind: 'sucesso', title: 'Copiado' });
        }}
      >
        Copiar
      </button>
      <pre style={{ maxHeight }} className="overflow-auto p-3 font-mono text-xs leading-relaxed text-accent-soft">
        {code}
      </pre>
    </div>
  );
}

// ---------- Diff lado a lado ----------
export function DiffView({ before, after, titleBefore = 'Antes', titleAfter = 'Depois' }: { before: string; after: string; titleBefore?: string; titleAfter?: string }) {
  const a = before.split('\n');
  const b = after.split('\n');
  const setA = new Set(a);
  const setB = new Set(b);
  return (
    <div className="grid grid-cols-2 gap-2 font-mono text-xs">
      {[{ t: titleBefore, lines: a, other: setB, cls: 'bg-danger/10 text-danger' }, { t: titleAfter, lines: b, other: setA, cls: 'bg-primary/10 text-primary' }].map((side) => (
        <div key={side.t} className="overflow-auto rounded-field border border-border bg-bg">
          <div className="border-b border-border px-3 py-1.5 font-sans text-xs text-text-muted">{side.t}</div>
          <pre className="p-2">
            {side.lines.map((l, i) => (
              <div key={i} className={cx('px-1', !side.other.has(l) && side.cls)}>
                {l || ' '}
              </div>
            ))}
          </pre>
        </div>
      ))}
    </div>
  );
}

// ---------- Glossário ----------
const GLOSSARY: Record<string, string> = {
  MCP: 'Model Context Protocol: padrão aberto para IDEs e agentes consumirem ferramentas e contexto.',
  contrato: 'Acordo entre quem produz e quem consome um dado: campos, qualidade e frescor.',
  embeddings: 'Representação numérica de trechos de texto usada para busca por significado.',
  PII: 'Dado pessoal identificável, como CPF, e-mail e telefone.',
  lakehouse: 'Repositório de dados em camadas: Bronze (bruto), Prata (limpo) e Ouro (pronto para consumo).',
  gate: 'Checagem automática ou aprovação que precisa passar antes da promoção de ambiente.',
  OC: 'Ordem de construção: pacote com tudo que o Claude Code precisa para implementar uma jornada.',
};

export function Term({ children, term }: { children: ReactNode; term?: keyof typeof GLOSSARY | string }) {
  const key = term ?? (typeof children === 'string' ? children : '');
  const def = GLOSSARY[key];
  if (!def) return <>{children}</>;
  return (
    <span className="cursor-help border-b border-dotted border-text-muted" title={def}>
      {children}
    </span>
  );
}

// ---------- Hidratação ----------
export function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}
