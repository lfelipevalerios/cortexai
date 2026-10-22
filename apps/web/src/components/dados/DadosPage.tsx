'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { BREAKING_FIELD } from '@cortex/seed';
import { PageHeader, Tabs, Term } from '@/components/ui';
import { useWs } from '@/lib/store';
import { useAutoAction, sleep } from '@/lib/tour-bus';
import { DominiosTab } from './Dominios';
import { ContratosTab } from './Contratos';
import { LakehouseTab } from './Lakehouse';
import { LinhagemTab } from './Linhagem';
import { QualidadeTab } from './Qualidade';
import { useContractEditor } from './useContractEditor';

type TabId = 'dominios' | 'contratos' | 'lakehouse' | 'linhagem' | 'qualidade';
const TAB_IDS: TabId[] = ['dominios', 'contratos', 'lakehouse', 'linhagem', 'qualidade'];

export function DadosPage() {
  const ws = useWs();
  const params = useSearchParams();
  const [tab, setTab] = useState<TabId>('dominios');
  const [tableId, setTableId] = useState<string | null>(null);
  const editor = useContractEditor(ws);
  const edRef = useRef(editor);
  edRef.current = editor;
  const breaking = BREAKING_FIELD[ws.workspace.industry];
  const breakingDomainId = ws.contracts.find((c) => c.id === breaking.contractId)?.domainId;

  // Deep links: /dados?contrato=<id>, ?tabela=<id>, ?aba=<id>.
  const qContrato = params.get('contrato');
  const qTabela = params.get('tabela');
  const qAba = params.get('aba');
  useEffect(() => {
    if (qContrato && ws.contracts.some((c) => c.id === qContrato)) {
      setTab('contratos');
      edRef.current.open(qContrato);
    } else if (qTabela && ws.tables.some((t) => t.id === qTabela)) {
      setTab('lakehouse');
      setTableId(qTabela);
    } else if (qAba && (TAB_IDS as string[]).includes(qAba)) {
      setTab(qAba as TabId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qContrato, qTabela, qAba]);

  const openContract = (id: string) => {
    setTab('contratos');
    editor.open(id);
  };

  const ensureBreakingOpen = async () => {
    if (tab !== 'contratos') {
      setTab('contratos');
      await sleep(300);
    }
    if (edRef.current.contractId !== breaking.contractId) {
      edRef.current.open(breaking.contractId);
      await sleep(500);
    }
    if (edRef.current.view !== 'visual') {
      edRef.current.setView('visual');
      await sleep(300);
    }
  };

  useAutoAction('dados.abrir-contrato', async () => {
    setTab('contratos');
    await sleep(350);
    // open() emite a ação.
    edRef.current.open(breaking.contractId);
    await sleep(300);
  });

  useAutoAction('contrato.remover-campo-usado', async () => {
    await ensureBreakingOpen();
    document.querySelector('[data-tour="contrato-campo-usado"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await sleep(500);
    if (edRef.current.fields.some((f) => f.name === breaking.field)) edRef.current.removeField(breaking.field);
    await sleep(300);
  });

  useAutoAction('contrato.tentar-publicar', async () => {
    await ensureBreakingOpen();
    if (edRef.current.fields.some((f) => f.name === breaking.field)) {
      edRef.current.removeField(breaking.field);
      await sleep(500);
    }
    await sleep(300);
    // tryPublish() emite a ação.
    edRef.current.tryPublish();
    await sleep(300);
    document.querySelector('[data-tour="contrato-publicar"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  return (
    <div>
      <PageHeader
        title="Dados"
        subtitle={
          <>
            Domínios, <Term term="contrato">contratos</Term> de dados visuais, <Term term="lakehouse">lakehouse</Term> em camadas, linhagem, qualidade e privacidade.
          </>
        }
      />
      <Tabs<TabId>
        className="mb-4"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'dominios', label: 'Domínios' },
          { id: 'contratos', label: 'Contratos' },
          { id: 'lakehouse', label: 'Lakehouse' },
          { id: 'linhagem', label: 'Linhagem' },
          { id: 'qualidade', label: 'Qualidade e privacidade' },
        ]}
      />
      {tab === 'dominios' && <DominiosTab ws={ws} highlightDomainId={breakingDomainId} onOpenContract={openContract} />}
      {tab === 'contratos' && <ContratosTab ws={ws} editor={editor} />}
      {tab === 'lakehouse' && <LakehouseTab ws={ws} tableId={tableId} onTable={setTableId} />}
      {tab === 'linhagem' && (
        <LinhagemTab
          ws={ws}
          onOpenContract={openContract}
          onOpenTable={(id) => {
            setTab('lakehouse');
            setTableId(id);
          }}
        />
      )}
      {tab === 'qualidade' && <QualidadeTab ws={ws} />}
    </div>
  );
}
