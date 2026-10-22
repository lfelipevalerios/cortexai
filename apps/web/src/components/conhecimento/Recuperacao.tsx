'use client';

import type { WorkspaceData } from '@cortex/schemas';
import { Search, Sparkles, BookOpen, Info } from 'lucide-react';
import { Button, Card, Chip, EmptyState, Input, Mono, Skeleton } from '@/components/ui';
import type { RetrievalResult } from './search';

export function RecuperacaoTab({
  ws, question, setQuestion, result, loading, onAsk, onOpenDoc, suggestion,
}: {
  ws: WorkspaceData;
  question: string;
  setQuestion: (q: string) => void;
  result: RetrievalResult | null;
  loading: boolean;
  onAsk: () => void;
  onOpenDoc: (id: string, chunk?: number) => void;
  suggestion: string;
}) {
  const colName = (id: string) => ws.collections.find((c) => c.id === id)?.name ?? id;
  const suggestions = Array.from(new Set([suggestion, ...ws.retrievals.map((r) => r.question)])).slice(0, 4);

  return (
    <div data-tour="conhecimento-pergunta" className="space-y-4">
      <Card className="p-4">
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            onAsk();
          }}
        >
          <div className="relative min-w-[260px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" strokeWidth={1.5} />
            <Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Pergunte à base de conhecimento…" className="pl-9" aria-label="Pergunta à base" />
          </div>
          <Button type="submit" variant="primary" icon={Sparkles} loading={loading} disabled={!question.trim()}>
            Perguntar
          </Button>
        </form>
        <div className="mt-3 flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button key={s} onClick={() => setQuestion(s)} className="rounded-full border border-border px-3 py-1 text-xs text-text-muted hover:border-accent hover:text-text">
              {s}
            </button>
          ))}
        </div>
      </Card>

      {loading && (
        <div className="space-y-2">
          <Skeleton className="h-20" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      )}

      {!loading && !result && (
        <EmptyState icon={Search} title="Faça uma pergunta" description="Você vê os trechos recuperados, a nota de relevância, o documento de origem e a resposta com citação." />
      )}

      {!loading && result && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-2">
            <div className="text-xs font-medium uppercase tracking-wide text-text-muted">Trechos recuperados</div>
            {result.chunks.length === 0 ? (
              <EmptyState title="Nenhum trecho relevante" description="Tente outras palavras ou confira se o documento já foi ingerido na coleção." />
            ) : (
              result.chunks.map((c, i) => (
                <Card key={`${c.doc.id}-${c.chunkIndex}`} halo={i === 0 ? 'green' : undefined} className="p-3">
                  <div className="flex items-center gap-3">
                    <Chip tone={i === 0 ? 'green' : 'muted'}>[{i + 1}]</Chip>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2" role="meter" aria-valuenow={Math.round(c.score * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Relevância">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${c.score * 100}%` }} />
                    </div>
                    <Mono className="text-primary">{c.score.toFixed(2)}</Mono>
                  </div>
                  <p className="mt-2 text-sm">{c.text}</p>
                  <button onClick={() => onOpenDoc(c.doc.id, c.chunkIndex)} className="mt-2 flex items-center gap-1.5 text-xs text-accent hover:underline">
                    <BookOpen className="h-3.5 w-3.5" strokeWidth={1.5} />
                    {c.doc.title} · versão {c.doc.version} · trecho {c.chunkIndex + 1}
                  </button>
                  <div className="mt-0.5 text-[11px] text-text-muted">{colName(c.doc.collectionId)}</div>
                </Card>
              ))
            )}
          </div>
          <div>
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-text-muted">Resposta</div>
            <Card className="p-4">
              {result.answer ? (
                <>
                  <p className="text-sm leading-relaxed">
                    {result.answer} <span className="font-mono text-xs text-primary">[1]</span>
                  </p>
                  {result.chunks[0] && (
                    <div className="mt-3 border-t border-border pt-2 text-xs text-text-muted">
                      [1] {result.chunks[0].doc.title}, versão {result.chunks[0].doc.version}
                    </div>
                  )}
                </>
              ) : result.chunks.length ? (
                <>
                  <div className="mb-2 flex items-start gap-2 text-xs text-text-muted">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
                    Pergunta fora do roteiro: busca por palavras-chave. No modo conectado, o agente redige a resposta a partir dos trechos.
                  </div>
                  <p className="text-sm leading-relaxed">
                    Segundo o documento, {result.chunks[0].text.charAt(0).toLowerCase() + result.chunks[0].text.slice(1)} <span className="font-mono text-xs text-primary">[1]</span>
                  </p>
                  <div className="mt-3 border-t border-border pt-2 text-xs text-text-muted">
                    [1] {result.chunks[0].doc.title}, versão {result.chunks[0].doc.version}
                  </div>
                </>
              ) : (
                <p className="text-sm text-text-muted">Sem trechos com evidência suficiente, o agente não responde: encaminha para um atendente.</p>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
