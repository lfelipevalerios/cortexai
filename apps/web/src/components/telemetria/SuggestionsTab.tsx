'use client';

import Link from 'next/link';
import { Lightbulb, Check, X, BarChart3, Sparkles, ArrowRight, FileText, Workflow, Inbox } from 'lucide-react';
import type { Component, Suggestion } from '@cortex/schemas';
import { SEED_TODAY } from '@cortex/seed';
import { useCortex, useWs } from '@/lib/store';
import { emitTourAction } from '@/lib/tour-bus';
import { Button, Card, Chip, EmptyState, StatusChip } from '@/components/ui';
import { PREFIX } from '@/components/governanca/shared';

const ORIGIN = (id: string) => `origem: sugestão ${id}`;

/** Componente rascunho criado a partir de uma sugestão (se houver). */
export function componentFromSuggestion(components: Component[], s: Suggestion): Component | undefined {
  return components.find((c) => c.content.includes(ORIGIN(s.id)));
}

function nameFrom(title: string): string {
  const m = title.match(/[“"]([^”"]+)[”"]/);
  return m ? m[1] : title.replace(/^(Criar|Adicionar)\s+(skill|regra)\s*/i, '');
}

/** Aceita a sugestão: status "aceita" e novo componente rascunho no Catálogo. */
export function acceptSuggestion(id: string): string | null {
  const s = useCortex.getState();
  const wsId = s.activeWorkspaceId;
  if (!wsId) return null;
  const data = s.workspaces[wsId];
  const sug = data.suggestions.find((x) => x.id === id);
  if (!sug || sug.status !== 'nova') return null;
  const p = PREFIX[data.workspace.industry];
  const n = data.components.filter((c) => c.id.startsWith(`${p}-cp-sug-`)).length + 1;
  const compId = `${p}-cp-sug-${n}`;
  const journey = sug.journeyId ? data.journeys.find((j) => j.id === sug.journeyId) : undefined;
  const doc = sug.sourceDocId ? data.documents.find((d) => d.id === sug.sourceDocId) : undefined;
  const owner = data.users.find((u) => u.profile === s.profile)?.name ?? data.users.find((u) => u.profile === 'champion')?.name ?? 'Champion AI';
  const comp: Component = {
    id: compId,
    type: sug.kind === 'skill' ? 'skill' : 'rule',
    name: nameFrom(sug.title),
    version: '0.1.0',
    status: 'rascunho',
    ...(journey ? { domainId: journey.domainId } : {}),
    owner,
    consumers: 0,
    rating: 0,
    description: sug.proposal,
    content: [
      `# ${nameFrom(sug.title)}`,
      `# ${ORIGIN(sug.id)} (telemetria)`,
      '',
      `objetivo: ${sug.proposal}`,
      `evidencia: ${sug.evidence}`,
      ...(doc ? [`fonte: ${doc.title} v${doc.version}`] : []),
      ...(journey ? [`jornada: ${journey.name}`] : []),
      '',
      'proximos_passos:',
      '  - revisar instruções e exemplos com o dono de negócio',
      '  - gerar casos de teste a partir dos traces de transbordo',
      '  - enviar para homologação do CoE AI',
    ].join('\n'),
    inputs: sug.kind === 'skill' ? ['pergunta do cliente', 'contexto da jornada'] : ['caso avaliado'],
    outputs: sug.kind === 'skill' ? ['resposta com fonte', 'ação preparada'] : ['decisão da regra'],
    dependencies: doc ? [doc.id] : [],
    changelog: [{ version: '0.1.0', date: SEED_TODAY, note: 'Rascunho criado a partir de sugestão do cérebro (telemetria).' }],
    evaluation: { score: 0, cases: 0, passed: 0 },
    approvals: [],
  };
  const before = s.mutate((d) => {
    const x = d.suggestions.find((y) => y.id === id);
    if (x) x.status = 'aceita';
    d.components = [comp, ...d.components];
  }, { action: 'Aceitou sugestão do cérebro e criou rascunho no Catálogo', object: comp.name });
  s.toast({
    kind: 'sucesso',
    title: `Rascunho “${comp.name}” criado no Catálogo`,
    description: `Este é o laço do slide 7: a telemetria realimenta o cérebro. Abra em /catalogo?id=${compId}`,
    undo: before ? () => useCortex.getState().replaceWorkspace(before) : undefined,
  });
  return compId;
}

export function SuggestionsTab() {
  const ws = useWs();
  const mutate = useCortex((s) => s.mutate);
  const replace = useCortex((s) => s.replaceWorkspace);
  const toast = useCortex((s) => s.toast);
  // Alvo da jornada guiada: o primeiro cartão não descartado (continua marcado depois de aceito).
  const firstNew = ws.suggestions.find((s) => s.status !== 'descartada');

  const discard = (sug: Suggestion) => {
    const before = mutate((d) => {
      const x = d.suggestions.find((y) => y.id === sug.id);
      if (x) x.status = 'descartada';
    }, { action: 'Descartou sugestão do cérebro', object: sug.title });
    toast({ kind: 'aviso', title: 'Sugestão descartada', description: sug.title, undo: before ? () => replace(before) : undefined });
  };

  const accept = (sug: Suggestion) => {
    if (acceptSuggestion(sug.id)) emitTourAction('sugestao.aceitar');
  };

  if (ws.suggestions.length === 0) {
    return <EmptyState icon={Inbox} title="Nenhuma sugestão por enquanto" description="Quando a telemetria encontrar padrões (transbordos, glosas, erros repetidos), o cérebro propõe skills e regras aqui." />;
  }

  return (
    <div className="space-y-4">
      <p className="max-w-3xl text-sm text-text-muted">Padrões da telemetria viram propostas. Aceitar cria o rascunho no Catálogo, pronto para revisão e homologação.</p>
      <div className="grid gap-4 lg:grid-cols-2">
        {ws.suggestions.map((sug) => {
          const journey = sug.journeyId ? ws.journeys.find((j) => j.id === sug.journeyId) : undefined;
          const doc = sug.sourceDocId ? ws.documents.find((d) => d.id === sug.sourceDocId) : undefined;
          const comp = componentFromSuggestion(ws.components, sug);
          const isTarget = sug.id === firstNew?.id;
          return (
            <Card key={sug.id} halo={sug.status === 'aceita' ? 'green' : undefined} className={sug.status === 'descartada' ? 'opacity-60' : undefined} data-tour={isTarget ? 'sugestao-aceitar' : undefined}>
              <div className="space-y-3 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Chip tone={sug.kind === 'skill' ? 'purple' : 'green'} icon={Sparkles}>{sug.kind === 'skill' ? 'Skill' : 'Regra'}</Chip>
                  {sug.status === 'nova' ? <Chip tone="lilac" icon={Lightbulb}>Nova</Chip> : <StatusChip status={sug.status === 'aceita' ? 'aprovado' : 'depreciado'} label={sug.status === 'aceita' ? 'Aceita' : 'Descartada'} />}
                </div>
                <div className="text-base font-semibold">{sug.title}</div>
                <div className="rounded-field border border-border bg-surface-2/40 p-3">
                  <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-accent"><BarChart3 className="h-3.5 w-3.5" />Evidência na telemetria</div>
                  <p className="text-sm">{sug.evidence}</p>
                </div>
                <div>
                  <div className="mb-1 text-xs font-medium text-primary">Proposta</div>
                  <p className="text-sm text-text-muted">{sug.proposal}</p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  {journey && (
                    <Link href={`/jornadas/studio?id=${journey.id}`} className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 hover:border-accent">
                      <Workflow className="h-3 w-3" />{journey.name}
                    </Link>
                  )}
                  {doc && (
                    <Link href="/conhecimento" className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 hover:border-accent">
                      <FileText className="h-3 w-3" />{doc.title}
                    </Link>
                  )}
                </div>
                {sug.status === 'nova' && (
                  <div className="flex gap-2 border-t border-border pt-3">
                    <Button variant="primary" size="sm" icon={Check} onClick={() => accept(sug)}>Aceitar</Button>
                    <Button variant="ghost" size="sm" icon={X} onClick={() => discard(sug)}>Descartar</Button>
                  </div>
                )}
                {sug.status === 'aceita' && comp && (
                  <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3 text-sm">
                    <span className="flex-1 text-text-muted">Este é o laço do slide 7: a telemetria realimenta o cérebro.</span>
                    <Link href={`/catalogo?id=${comp.id}`} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                      Abrir rascunho no Catálogo <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
