'use client';

import { useRef, useState } from 'react';
import type { KnowledgeDocument, WorkspaceData } from '@cortex/schemas';
import { formatNumber } from '@cortex/engine';
import { Upload, FileText, CheckCircle2, Loader2, Cloud, HardDrive, Settings2 } from 'lucide-react';
import { Button, Card, CardHeader, Chip, Field, Select, Progress, Mono, cx } from '@/components/ui';
import { useCortex, demoNow } from '@/lib/store';
import { sleep } from '@/lib/tour-bus';
import { chunkText } from './search';

const STAGES = ['Extrair texto', 'Dividir em trechos', 'Gerar embeddings', 'Indexar'] as const;

const CHUNKING = [
  { value: 'secao-400', label: 'Por seção, até 400 tokens (padrão)', chars: 1600 },
  { value: 'paragrafo', label: 'Por parágrafo', chars: 600 },
  { value: 'fixo-200', label: 'Tamanho fixo, 200 tokens com 20 de sobreposição', chars: 800 },
  { value: 'clausula', label: 'Por cláusula (contratos e normas)', chars: 900 },
];
const MODELS = [
  { value: 'multilingual-e5-large', label: 'multilingual-e5-large (padrão)' },
  { value: 'bge-m3', label: 'bge-m3' },
  { value: 'text-embedding-3-large', label: 'text-embedding-3-large' },
];
const METADATA = ['Título', 'Versão', 'Data de vigência', 'Domínio', 'Classificação (PII)', 'Autor'];

interface Item {
  id: string;
  name: string;
  size: number;
  collectionId: string;
  stage: number; // 0..4 (4 = concluído)
  progress: number;
  simulated: boolean;
  chunks?: number;
  docId?: string;
}

let seq = 1;

export function IngestaoTab({ ws, onOpenDoc }: { ws: WorkspaceData; onOpenDoc: (id: string) => void }) {
  const mutate = useCortex((s) => s.mutate);
  const replaceWorkspace = useCortex((s) => s.replaceWorkspace);
  const toast = useCortex((s) => s.toast);
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [collectionId, setCollectionId] = useState(ws.collections[0]?.id ?? '');
  const [chunking, setChunking] = useState(CHUNKING[0].value);
  const [model, setModel] = useState(MODELS[0].value);
  const [meta, setMeta] = useState<string[]>(METADATA.slice(0, 4));
  const [dragging, setDragging] = useState(false);

  const patch = (id: string, p: Partial<Item>) => setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...p } : x)));

  const ingest = async (file: File) => {
    const id = `up-${seq++}`;
    const textual = /\.(txt|md|markdown)$/i.test(file.name) || file.type.startsWith('text/');
    const item: Item = { id, name: file.name, size: file.size, collectionId, stage: 0, progress: 0, simulated: !textual };
    setItems((xs) => [item, ...xs]);
    let text = '';
    if (textual) {
      try {
        text = await file.text();
      } catch {
        text = '';
      }
    }
    for (let s = 0; s < STAGES.length; s++) {
      patch(id, { stage: s });
      for (let p = 0; p <= 100; p += 20) {
        patch(id, { progress: (s * 100 + p) / STAGES.length });
        await sleep(90);
      }
    }
    const maxChars = CHUNKING.find((c) => c.value === chunking)?.chars ?? 1600;
    const chunks = text.trim()
      ? chunkText(text, maxChars).slice(0, 40)
      : [
          `Conteúdo extraído de ${file.name} (simulado no modo demonstração: só .txt e .md são lidos no navegador).`,
          'No modo conectado, PDFs, DOCX e planilhas passam por extração de texto, OCR quando necessário e detecção de PII.',
        ];
    const docId = `${ws.workspace.id}-doc-up-${Date.now()}`;
    const title = file.name.replace(/\.[^.]+$/, '');
    const doc: KnowledgeDocument = { id: docId, collectionId: item.collectionId, title, version: '1.0', updatedAt: demoNow(), status: 'processado', chunks };
    const before = mutate((w) => {
      w.documents = [doc, ...w.documents];
    }, { action: 'Ingeriu documento na base de conhecimento', object: title });
    patch(id, { stage: 4, progress: 100, chunks: chunks.length, docId });
    toast({
      kind: 'sucesso',
      title: `${title} indexado`,
      description: `${chunks.length} trechos com ${model}.`,
      undo: before ? () => replaceWorkspace(before) : undefined,
    });
  };

  const onFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((f) => void ingest(f));
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-4">
        <Card className="p-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              onFiles(e.dataTransfer.files);
            }}
            className={cx(
              'flex flex-col items-center justify-center rounded-card border border-dashed px-6 py-10 text-center transition-colors',
              dragging ? 'border-primary bg-primary/5' : 'border-border',
            )}
          >
            <Upload className="mb-3 h-8 w-8 text-accent" strokeWidth={1.5} />
            <div className="text-sm font-semibold">Arraste arquivos ou escolha no computador</div>
            <p className="mt-1 max-w-md text-xs text-text-muted">
              Arquivos .txt e .md são lidos de verdade no navegador. Outros formatos (PDF, DOCX) têm o processamento simulado na demonstração.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Button variant="primary" size="sm" icon={FileText} onClick={() => inputRef.current?.click()}>Escolher arquivos</Button>
              <Button variant="tertiary" size="sm" icon={Cloud} onClick={() => toast({ kind: 'info', title: 'Sincronização com SharePoint', description: 'Disponível no modo conectado; na demonstração use o upload.' })}>SharePoint</Button>
              <Button variant="tertiary" size="sm" icon={HardDrive} onClick={() => toast({ kind: 'info', title: 'Sincronização com Drive', description: 'Disponível no modo conectado; na demonstração use o upload.' })}>Drive</Button>
            </div>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".txt,.md,.markdown,.pdf,.docx,.doc"
              className="hidden"
              onChange={(e) => {
                onFiles(e.target.files);
                e.target.value = '';
              }}
            />
          </div>
          <div className="mt-3 max-w-sm">
            <Field label="Coleção de destino">
              <Select value={collectionId} onChange={(e) => setCollectionId(e.target.value)} options={ws.collections.map((c) => ({ value: c.id, label: c.name }))} />
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader title="Processamento" subtitle="Extrair → dividir → embeddings → indexar" />
          <div className="p-4">
            {items.length === 0 ? (
              <p className="text-sm text-text-muted">Nenhum arquivo nesta sessão. Os documentos processados entram na coleção escolhida e ficam disponíveis para recuperação.</p>
            ) : (
              <ul className="space-y-3">
                {items.map((it) => (
                  <li key={it.id} className="rounded-field border border-border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <FileText className="h-4 w-4 text-text-muted" strokeWidth={1.5} />
                      <span className="text-sm font-medium">{it.name}</span>
                      <span className="text-xs text-text-muted">{formatNumber(it.size / 1024, 1)} KB</span>
                      {it.simulated && <Chip tone="muted">simulado</Chip>}
                      <span className="ml-auto">
                        {it.stage >= 4 ? (
                          <Chip tone="green" icon={CheckCircle2}>Indexado · {it.chunks} trechos</Chip>
                        ) : (
                          <Chip tone="lilac" icon={Loader2}>{STAGES[it.stage]}</Chip>
                        )}
                      </span>
                    </div>
                    <div className="mt-2">
                      <Progress value={it.progress} tone={it.stage >= 4 ? 'green' : 'purple'} />
                    </div>
                    <div className="mt-1.5 grid grid-cols-4 gap-1 text-[11px]">
                      {STAGES.map((s, i) => (
                        <span key={s} className={cx(i < it.stage || it.stage >= 4 ? 'text-primary' : i === it.stage ? 'text-text' : 'text-text-muted')}>
                          {i < it.stage || it.stage >= 4 ? '✓ ' : ''}{s}
                        </span>
                      ))}
                    </div>
                    {it.docId && (
                      <button className="mt-2 text-xs text-accent hover:underline" onClick={() => onOpenDoc(it.docId!)}>
                        Ver trechos
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>

      <Card className="h-fit">
        <CardHeader title="Preparo" subtitle="Padrões pré-definidos; ajuste se precisar" icon={Settings2} />
        <div className="space-y-4 p-4">
          <Field label="Estratégia de divisão em trechos">
            <Select value={chunking} onChange={(e) => setChunking(e.target.value)} options={CHUNKING} />
          </Field>
          <Field label="Modelo de embeddings" hint="Processamento no Brasil para coleções com dado sensível.">
            <Select value={model} onChange={(e) => setModel(e.target.value)} options={MODELS} />
          </Field>
          <div>
            <div className="mb-1 text-xs font-medium text-text-muted">Metadados extraídos</div>
            <div className="flex flex-wrap gap-2">
              {METADATA.map((m) => {
                const on = meta.includes(m);
                return (
                  <button
                    key={m}
                    aria-pressed={on}
                    onClick={() => setMeta((xs) => (on ? xs.filter((x) => x !== m) : [...xs, m]))}
                    className={cx('rounded-full border px-2.5 py-0.5 text-xs', on ? 'border-primary/50 bg-primary/10 text-primary' : 'border-border text-text-muted')}
                  >
                    {on ? '✓ ' : ''}{m}
                  </button>
                );
              })}
            </div>
          </div>
          <p className="text-xs text-text-muted">
            Coleção atual usa <Mono>{ws.collections.find((c) => c.id === collectionId)?.embeddingModel}</Mono> e {ws.collections.find((c) => c.id === collectionId)?.chunking.toLowerCase()}.
          </p>
        </div>
      </Card>
    </div>
  );
}
