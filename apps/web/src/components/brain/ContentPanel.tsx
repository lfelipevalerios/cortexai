'use client';

import { useEffect, useRef, useState } from 'react';
import { Download, ExternalLink, FileUp, Paperclip, Trash2, X } from 'lucide-react';
import type { Attachment, NodeContent, NodePath } from '@cortex/schemas';
import { useCortex } from '@/lib/store';
import { formatSize, getFile, putFile } from '@/lib/files';
import { IconButton, Textarea, cx } from '@/components/ui';

const MAX_BYTES = 25 * 1024 * 1024;
const PREVIEWABLE = /^(image\/|application\/pdf|text\/)/;

/** Painel lateral de um nó da árvore: texto livre e arquivos. */
export function ContentPanel({ path, label, title, hint, content, onClose }: {
  path: NodePath; label: string; title: string; hint: string; content: NodeContent; onClose: () => void;
}) {
  const setText = useCortex((s) => s.setText);
  const addAttachment = useCortex((s) => s.addAttachment);
  const removeAttachment = useCortex((s) => s.removeAttachment);
  const toast = useCortex((s) => s.toast);
  const pathKey = JSON.stringify(path);

  const [text, setLocal] = useState(content.text);
  const [saved, setSaved] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);

  // Outro nó selecionado: recarrega o texto.
  useEffect(() => {
    setLocal(content.text);
    setSaved(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathKey]);

  const onText = (v: string) => {
    setLocal(v);
    setSaved(false);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setText(path, v);
      setSaved(true);
    }, 600);
  };

  const upload = async (files: FileList | File[]) => {
    for (const f of Array.from(files)) {
      if (f.size > MAX_BYTES) {
        toast('erro', `${f.name} passa de 25 MB`);
        continue;
      }
      setUploading((n) => n + 1);
      const id = `f-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
      try {
        await putFile(id, f);
        const meta: Attachment = { id, name: f.name, size: f.size, type: f.type || 'application/octet-stream', addedAt: new Date().toISOString() };
        addAttachment(path, meta);
      } catch {
        toast('erro', `Não foi possível guardar ${f.name}`);
      } finally {
        setUploading((n) => n - 1);
      }
    }
  };

  const openFile = async (a: Attachment, download: boolean) => {
    const blob = await getFile(a.id).catch(() => undefined);
    if (!blob) {
      toast('erro', 'Arquivo não encontrado neste navegador');
      return;
    }
    const url = URL.createObjectURL(blob);
    if (download) {
      const link = document.createElement('a');
      link.href = url;
      link.download = a.name;
      link.click();
    } else {
      window.open(url, '_blank', 'noopener');
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  return (
    <aside className="flex h-full w-[440px] max-w-full shrink-0 animate-fade-in flex-col border-l border-border bg-surface-1" aria-label={`Conteúdo: ${title}`}>
      <div className="flex items-start justify-between gap-2 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <div className="text-[11px] font-medium uppercase tracking-wider text-text-muted">{label}</div>
          <div className="truncate text-lg font-semibold">{title}</div>
          <p className="mt-1 text-xs text-text-muted">{hint}</p>
        </div>
        <IconButton icon={X} label="Fechar painel" onClick={onClose} />
      </div>

      <div className="min-h-0 flex-1 space-y-6 overflow-auto px-5 py-4">
        <section>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-medium text-text-muted">Texto</span>
            <span className="text-[11px] text-text-muted">{saved ? 'Salvo' : 'Salvando…'}</span>
          </div>
          <Textarea
            value={text}
            onChange={(e) => onText(e.target.value)}
            onBlur={() => {
              clearTimeout(timer.current);
              if (!saved) {
                setText(path, text);
                setSaved(true);
              }
            }}
            placeholder="Escreva aqui o que o cérebro precisa saber sobre este item."
            className="min-h-[220px] leading-relaxed"
          />
        </section>

        <section>
          <div className="mb-1.5 text-xs font-medium text-text-muted">Arquivos</div>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              upload(e.dataTransfer.files);
            }}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
            className={cx(
              'flex cursor-pointer flex-col items-center justify-center gap-1 rounded-card border border-dashed px-4 py-6 text-center text-sm transition-colors',
              dragging ? 'border-primary bg-primary/5 text-primary' : 'border-border text-text-muted hover:border-accent hover:text-text',
            )}
          >
            <FileUp className="h-6 w-6" strokeWidth={1.5} />
            {uploading > 0 ? 'Guardando…' : 'Arraste arquivos ou clique para escolher'}
            <span className="text-[11px] text-text-muted">Até 25 MB por arquivo</span>
          </div>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) upload(e.target.files);
              e.target.value = '';
            }}
          />

          {content.files.length > 0 && (
            <ul className="mt-3 space-y-2">
              {content.files.map((a) => (
                <li key={a.id} className="flex items-center gap-2 rounded-field border border-border bg-surface-2 px-3 py-2">
                  <Paperclip className="h-4 w-4 shrink-0 text-accent" strokeWidth={1.5} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{a.name}</span>
                    <span className="block text-[11px] text-text-muted">
                      {formatSize(a.size)} · {new Date(a.addedAt).toLocaleDateString('pt-BR')}
                    </span>
                  </span>
                  {PREVIEWABLE.test(a.type) && <IconButton icon={ExternalLink} label="Abrir" onClick={() => openFile(a, false)} />}
                  <IconButton icon={Download} label="Baixar" onClick={() => openFile(a, true)} />
                  <IconButton
                    icon={Trash2}
                    label="Remover"
                    className="hover:text-danger"
                    onClick={() => {
                      if (confirm(`Remover ${a.name}?`)) removeAttachment(path, a.id);
                    }}
                  />
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[11px] text-text-muted">Os arquivos ficam guardados neste navegador.</p>
        </section>
      </div>
    </aside>
  );
}
