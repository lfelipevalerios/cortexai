'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Download, FileUp, History, Paperclip, Save, Trash2, X } from 'lucide-react';
import { MAX_FILE_BYTES, type NodeFile, type NodeVersion, type TreeNode } from '@cortex/schemas';
import { api, keys } from '@/lib/api';
import { toast } from '@/lib/store';
import { Loading } from '@/components/States';
import { Button, IconButton, Input, Textarea, cx } from '@/components/ui';

const when = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}

/** Painel lateral de um nó: texto versionado, histórico e arquivos versionados. */
export function ContentPanel({ node, workspaceId, label, title, hint, onClose }: {
  node: TreeNode; workspaceId: string; label: string; title: string; hint: string; onClose: () => void;
}) {
  const [tab, setTab] = useState<'conteudo' | 'historico'>('conteudo');
  const qc = useQueryClient();
  const refreshTree = () => qc.invalidateQueries({ queryKey: keys.tree(workspaceId) });

  return (
    <aside className="flex h-full w-[460px] max-w-full shrink-0 animate-fade-in flex-col border-l border-border bg-surface-1" aria-label={`Conteúdo: ${title}`}>
      <div className="flex items-start justify-between gap-2 border-b border-border px-5 pt-4">
        <div className="min-w-0 pb-3">
          <div className="text-[11px] font-medium uppercase tracking-wider text-text-muted">{label}</div>
          <div className="truncate text-lg font-semibold">{title}</div>
          <p className="mt-1 text-xs text-text-muted">{hint}</p>
          <div role="tablist" className="mt-3 flex gap-1">
            {(['conteudo', 'historico'] as const).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={cx('-mb-3 border-b-2 px-2 pb-2 text-sm font-medium', tab === t ? 'border-primary text-text' : 'border-transparent text-text-muted hover:text-text')}
              >
                {t === 'conteudo' ? 'Conteúdo' : 'Histórico'}
              </button>
            ))}
          </div>
        </div>
        <IconButton icon={X} label="Fechar painel" onClick={onClose} />
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
        {tab === 'conteudo' ? (
          <div className="space-y-6">
            <TextSection node={node} onSaved={refreshTree} />
            <FilesSection nodeId={node.id} onChanged={refreshTree} />
          </div>
        ) : (
          <HistorySection nodeId={node.id} onRestored={refreshTree} />
        )}
      </div>
    </aside>
  );
}

function TextSection({ node, onSaved }: { node: TreeNode; onSaved: () => void }) {
  const qc = useQueryClient();
  const [text, setText] = useState(node.body);
  const [status, setStatus] = useState<{ version: number; by: string; at: string }>({ version: node.version, by: node.updatedBy, at: node.updatedAt });
  const [dirty, setDirty] = useState(false);
  const [noting, setNoting] = useState(false);
  const [note, setNote] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const latest = useRef({ text, dirty });
  latest.current = { text, dirty };

  const save = useMutation({
    mutationFn: (v: { body: string; note?: string }) => api.updateNode(node.id, v),
    onSuccess: (ver: NodeVersion, v) => {
      setStatus({ version: ver.version, by: ver.createdBy, at: ver.createdAt });
      if (latest.current.text === v.body) setDirty(false);
      qc.invalidateQueries({ queryKey: keys.versions(node.id) });
      onSaved();
    },
    onError: (e) => toast('erro', `Texto não salvo: ${e.message}`),
  });

  // Ao fechar o painel com texto pendente, grava antes de sair.
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      if (latest.current.dirty) api.updateNode(node.id, { body: latest.current.text }).then(onSaved).catch(() => toast('erro', 'Texto não salvo'));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [node.id],
  );

  const onChange = (v: string) => {
    setText(v);
    setDirty(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => save.mutate({ body: v }), 1000);
  };

  const checkpoint = () => {
    clearTimeout(timer.current);
    save.mutate(
      { body: text, note: note.trim() || 'Versão salva' },
      { onSuccess: (v) => toast('sucesso', `Versão ${v.version} salva`) },
    );
    setNoting(false);
    setNote('');
  };

  return (
    <section>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-text-muted">Texto</span>
        <span className="truncate text-[11px] text-text-muted">
          {dirty || save.isPending ? 'Salvando…' : `Versão ${status.version} · ${status.by || 'Anônimo'} · ${when(status.at)}`}
        </span>
      </div>
      <Textarea
        value={text}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Escreva aqui o que o cérebro precisa saber sobre este item."
        className="min-h-[220px] leading-relaxed"
      />
      {noting ? (
        <div className="mt-2 flex gap-2">
          <Input autoFocus value={note} onChange={(e) => setNote(e.target.value)} placeholder="O que mudou nesta versão?" onKeyDown={(e) => e.key === 'Enter' && checkpoint()} />
          <Button variant="primary" onClick={checkpoint}>Salvar</Button>
          <Button variant="ghost" onClick={() => setNoting(false)}>Cancelar</Button>
        </div>
      ) : (
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="text-[11px] text-text-muted">O texto é salvo enquanto você digita. Use “Salvar versão” para marcar um ponto no histórico.</p>
          <Button icon={Save} onClick={() => setNoting(true)} className="shrink-0">Salvar versão</Button>
        </div>
      )}
    </section>
  );
}

function FilesSection({ nodeId, onChanged }: { nodeId: string; onChanged: () => void }) {
  const qc = useQueryClient();
  const files = useQuery({ queryKey: keys.files(nodeId), queryFn: () => api.files(nodeId) });
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const changed = () => {
    qc.invalidateQueries({ queryKey: keys.files(nodeId) });
    onChanged();
  };

  const upload = async (list: FileList | File[]) => {
    for (const f of Array.from(list)) {
      if (f.size > MAX_FILE_BYTES) {
        toast('erro', `${f.name} passa de 25 MB`);
        continue;
      }
      setUploading((n) => n + 1);
      try {
        const res = await api.upload(nodeId, f);
        qc.invalidateQueries({ queryKey: keys.fileVersions(res.id) });
        toast('sucesso', res.current.version > 1 ? `${f.name}: versão ${res.current.version}` : `${f.name} enviado`);
      } catch (e) {
        toast('erro', `${f.name}: ${(e as Error).message}`);
      } finally {
        setUploading((n) => n - 1);
      }
    }
    changed();
  };

  const remove = useMutation({
    mutationFn: api.deleteFile,
    onSuccess: changed,
    onError: (e) => toast('erro', e.message),
  });

  return (
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
          'flex cursor-pointer flex-col items-center justify-center gap-1 rounded-card border border-dashed px-4 py-5 text-center text-sm transition-colors',
          dragging ? 'border-primary bg-primary/5 text-primary' : 'border-border text-text-muted hover:border-accent hover:text-text',
        )}
      >
        <FileUp className="h-6 w-6" strokeWidth={1.5} />
        {uploading > 0 ? 'Enviando…' : 'Arraste arquivos ou clique para escolher'}
        <span className="text-[11px] text-text-muted">Até 25 MB · mesmo nome vira nova versão</span>
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

      {files.isLoading ? (
        <Loading />
      ) : (
        files.data &&
        files.data.length > 0 && (
          <ul className="mt-3 space-y-2">
            {files.data.map((f) => (
              <FileRow key={f.id} file={f} onRemove={() => confirm(`Remover ${f.name}? As versões anteriores continuam no histórico.`) && remove.mutate(f.id)} />
            ))}
          </ul>
        )
      )}
    </section>
  );
}

function FileRow({ file, onRemove }: { file: NodeFile; onRemove: () => void }) {
  const [open, setOpen] = useState(false);
  const versions = useQuery({ queryKey: keys.fileVersions(file.id), queryFn: () => api.fileVersions(file.id), enabled: open });
  return (
    <li className="rounded-field border border-border bg-surface-2">
      <div className="flex items-center gap-2 px-3 py-2">
        <Paperclip className="h-4 w-4 shrink-0 text-accent" strokeWidth={1.5} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm">{file.name}</span>
          <span className="block text-[11px] text-text-muted">
            v{file.current.version} · {formatSize(file.current.size)} · {file.current.createdBy || 'Anônimo'} · {when(file.current.createdAt)}
          </span>
        </span>
        <a href={api.downloadUrl(file.id)} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-text-muted hover:bg-surface-1 hover:text-text" title="Baixar" aria-label="Baixar">
          <Download className="h-4 w-4" strokeWidth={1.5} />
        </a>
        <IconButton icon={Trash2} label="Remover" className="hover:text-danger" onClick={onRemove} />
      </div>
      {file.versionCount > 1 && (
        <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-1 border-t border-border px-3 py-1.5 text-left text-[11px] text-text-muted hover:text-text">
          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          {file.versionCount} versões
        </button>
      )}
      {open && (
        <ul className="border-t border-border px-3 py-2">
          {(versions.data ?? []).map((v) => (
            <li key={v.version} className="flex items-center justify-between gap-2 py-1 text-[11px] text-text-muted">
              <span>
                v{v.version} · {formatSize(v.size)} · {v.createdBy || 'Anônimo'} · {when(v.createdAt)}
              </span>
              <a href={api.downloadUrl(file.id, v.version)} className="font-medium text-primary-soft hover:underline">
                Baixar
              </a>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function HistorySection({ nodeId, onRestored }: { nodeId: string; onRestored: () => void }) {
  const qc = useQueryClient();
  const versions = useQuery({ queryKey: keys.versions(nodeId), queryFn: () => api.versions(nodeId) });
  const [selected, setSelected] = useState<number | null>(null);
  const restore = useMutation({
    mutationFn: (v: number) => api.restore(nodeId, v),
    onSuccess: (v) => {
      toast('sucesso', `Restaurado como versão ${v.version}`);
      qc.invalidateQueries({ queryKey: keys.versions(nodeId) });
      onRestored();
      setSelected(null);
    },
    onError: (e) => toast('erro', e.message),
  });

  if (versions.isLoading) return <Loading />;
  const list = versions.data ?? [];
  const current = list[0]?.version;
  const shown = list.find((v) => v.version === selected);

  return (
    <div className="space-y-3">
      <p className="flex items-center gap-1.5 text-xs text-text-muted">
        <History className="h-3.5 w-3.5" /> {list.length} {list.length === 1 ? 'versão' : 'versões'}. Restaurar cria uma versão nova; nada é sobrescrito.
      </p>
      <ul className="space-y-1.5">
        {list.map((v) => (
          <li key={v.version}>
            <button
              onClick={() => setSelected(selected === v.version ? null : v.version)}
              className={cx('w-full rounded-field border px-3 py-2 text-left transition-colors', selected === v.version ? 'border-primary/60 bg-surface-2' : 'border-border hover:border-accent')}
            >
              <span className="flex items-center justify-between gap-2 text-sm">
                <span className="font-medium">
                  Versão {v.version}
                  {v.version === current && <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] text-primary">atual</span>}
                </span>
                <span className="text-[11px] text-text-muted">{when(v.createdAt)}</span>
              </span>
              <span className="block text-[11px] text-text-muted">
                {v.createdBy || 'Anônimo'}
                {v.note && ` · ${v.note}`}
              </span>
            </button>
            {shown?.version === v.version && (
              <div className="mt-1.5 space-y-2 rounded-field border border-border bg-bg p-3">
                {v.name && <div className="text-xs text-text-muted">Nome: {v.name}{v.summary && ` · ${v.summary}`}</div>}
                <pre className="max-h-64 overflow-auto whitespace-pre-wrap font-sans text-sm text-text">{v.body || <span className="text-text-muted">Sem texto.</span>}</pre>
                {v.version !== current && (
                  <Button variant="primary" onClick={() => restore.mutate(v.version)} disabled={restore.isPending}>
                    Restaurar esta versão
                  </Button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
