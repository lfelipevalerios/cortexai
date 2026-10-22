'use client';

import { clsx } from 'clsx';
import { useEffect, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { X, CheckCircle2, XCircle, Info, type LucideIcon } from 'lucide-react';
import { useUi } from '@/lib/store';

export const cx = clsx;

export function Button({
  variant = 'secondary', icon: Icon, className, children, ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; icon?: LucideIcon }) {
  return (
    <button
      {...rest}
      className={cx(
        'inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-full px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        variant === 'primary' && 'bg-primary text-on-primary hover:bg-primary-soft',
        variant === 'secondary' && 'border border-border text-text hover:border-accent hover:bg-surface-2',
        variant === 'ghost' && 'text-text-muted hover:bg-surface-2 hover:text-text',
        variant === 'danger' && 'border border-danger/50 text-danger hover:bg-danger/10',
        className,
      )}
    >
      {Icon && <Icon className="h-4 w-4" strokeWidth={1.5} />}
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
      className={cx('inline-flex h-8 w-8 items-center justify-center rounded-full text-text-muted hover:bg-surface-2 hover:text-text', className)}
    >
      <Icon className="h-4 w-4" strokeWidth={1.5} />
    </button>
  );
}

const field = 'w-full rounded-field border border-border bg-surface-2 px-3 py-2 text-sm text-text placeholder:text-text-muted/70 focus:border-primary focus:outline-none';

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(field, props.className)} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx(field, 'resize-y', props.className)} />;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-text-muted">{label}</span>
      {children}
    </label>
  );
}

export function Modal({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/70 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()} className="w-[460px] max-w-full animate-fade-in rounded-card border border-border bg-surface-1 shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="text-base font-semibold">{title}</div>
          <IconButton icon={X} label="Fechar" onClick={onClose} />
        </div>
        <div className="space-y-3 px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-border px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

/** Formulário de nome + resumo, usado para criar e renomear frentes e jornadas. */
export function NameModal({ open, onClose, title, initial, onSave, submitLabel = 'Salvar' }: {
  open: boolean; onClose: () => void; title: string; initial?: { name: string; summary: string }; onSave: (name: string, summary: string) => void; submitLabel?: string;
}) {
  const [name, setName] = useState('');
  const [summary, setSummary] = useState('');
  useEffect(() => {
    if (open) {
      setName(initial?.name ?? '');
      setSummary(initial?.summary ?? '');
    }
  }, [open, initial?.name, initial?.summary]);
  const submit = () => {
    if (!name.trim()) return;
    onSave(name.trim(), summary.trim());
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title={title} footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="primary" onClick={submit} disabled={!name.trim()}>{submitLabel}</Button></>}>
      <Field label="Nome">
        <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
      </Field>
      <Field label="Resumo (opcional)">
        <Input value={summary} onChange={(e) => setSummary(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
      </Field>
    </Modal>
  );
}

export function Toaster() {
  const toasts = useUi((s) => s.toasts);
  const icon = { sucesso: CheckCircle2, erro: XCircle, info: Info };
  const tone = { sucesso: 'text-primary', erro: 'text-danger', info: 'text-accent' };
  return (
    <div className="pointer-events-none fixed bottom-5 left-1/2 z-[90] flex -translate-x-1/2 flex-col gap-2" aria-live="polite">
      {toasts.map((t) => {
        const Icon = icon[t.kind];
        return (
          <div key={t.id} className="flex animate-fade-in items-center gap-2 rounded-full border border-border bg-surface-1 px-4 py-2 text-sm shadow-2xl">
            <Icon className={cx('h-4 w-4', tone[t.kind])} strokeWidth={1.5} />
            {t.title}
          </div>
        );
      })}
    </div>
  );
}
