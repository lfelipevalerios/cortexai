'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { DEMO_IDS } from '@cortex/seed';
import { PageHeader, Tabs } from '@/components/ui';
import { cortex, useWs } from '@/lib/store';
import { emitTourAction, sleep, useAutoAction } from '@/lib/tour-bus';
import { ColecoesTab, DocDrawer } from './Colecoes';
import { IngestaoTab } from './Ingestao';
import { RecuperacaoTab } from './Recuperacao';
import { GrafoTab } from './Grafo';
import { retrieve, normalize, type RetrievalResult } from './search';

type TabId = 'colecoes' | 'ingestao' | 'recuperacao' | 'grafo';
const TAB_IDS: TabId[] = ['colecoes', 'ingestao', 'recuperacao', 'grafo'];

export function ConhecimentoPage() {
  const ws = useWs();
  const params = useSearchParams();
  const showcase = DEMO_IDS[ws.workspace.industry].showcaseQuestion;
  const [tab, setTab] = useState<TabId>('colecoes');
  const [doc, setDoc] = useState<{ id: string; chunk?: number } | null>(null);
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState<RetrievalResult | null>(null);
  const [loading, setLoading] = useState(false);
  const qRef = useRef(question);
  qRef.current = question;

  const qDoc = params.get('doc');
  const qAba = params.get('aba');
  const qPergunta = params.get('pergunta');
  useEffect(() => {
    if (qDoc && ws.documents.some((d) => d.id === qDoc)) {
      setTab('colecoes');
      setDoc({ id: qDoc });
    } else if (qPergunta) {
      setTab('recuperacao');
      setQuestion(qPergunta);
    } else if (qAba && (TAB_IDS as string[]).includes(qAba)) {
      setTab(qAba as TabId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qDoc, qAba, qPergunta]);

  const ask = async (q = qRef.current) => {
    if (!q.trim()) return;
    setLoading(true);
    setResult(null);
    await sleep(650);
    const st = cortex.ws() ?? ws;
    const r = retrieve(q, st.retrievals, st.documents);
    setResult(r);
    setLoading(false);
    if (normalize(q) === normalize(showcase) || r.scripted) emitTourAction('conhecimento.perguntar');
  };

  useAutoAction('conhecimento.perguntar', async () => {
    setTab('recuperacao');
    setResult(null);
    setQuestion('');
    await sleep(350);
    for (let i = 1; i <= showcase.length; i++) {
      setQuestion(showcase.slice(0, i));
      await sleep(22);
    }
    await sleep(250);
    // ask() emite a ação ao responder.
    await ask(showcase);
  });

  return (
    <div>
      <PageHeader
        title="Conhecimento"
        subtitle="Base de conhecimento agêntica: coleções por tema, ingestão com preparo, teste de recuperação com fonte e grafo de conhecimento."
      />
      <Tabs<TabId>
        className="mb-4"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'colecoes', label: 'Coleções' },
          { id: 'ingestao', label: 'Ingestão' },
          { id: 'recuperacao', label: 'Testar recuperação' },
          { id: 'grafo', label: 'Grafo' },
        ]}
      />
      {tab === 'colecoes' && <ColecoesTab ws={ws} onOpenDoc={(id) => setDoc({ id })} />}
      {tab === 'ingestao' && <IngestaoTab ws={ws} onOpenDoc={(id) => setDoc({ id })} />}
      {tab === 'recuperacao' && (
        <RecuperacaoTab
          ws={ws}
          question={question}
          setQuestion={setQuestion}
          result={result}
          loading={loading}
          onAsk={() => void ask()}
          onOpenDoc={(id, chunk) => setDoc({ id, chunk })}
          suggestion={showcase}
        />
      )}
      {tab === 'grafo' && <GrafoTab ws={ws} onOpenDoc={(id) => setDoc({ id })} />}
      <DocDrawer ws={ws} docId={doc?.id ?? null} highlight={doc?.chunk} onClose={() => setDoc(null)} />
    </div>
  );
}
