'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useWs } from '@/lib/store';
import { emitTourAction, sleep, useAutoAction } from '@/lib/tour-bus';
import { PageHeader, Tabs } from '@/components/ui';
import { BrainMap, type BrainMapApi } from '@/components/cerebro/BrainMap';
import { BusinessView } from '@/components/cerebro/BusinessView';
import { TechView } from '@/components/cerebro/TechView';
import type { DecisionTableApi } from '@/components/cerebro/DecisionTableView';
import { showcaseTableId } from '@/components/cerebro/lib';

type Tab = 'mapa' | 'negocio' | 'tecnico';

export default function CerebroPage() {
  return (
    <Suspense fallback={null}>
      <Cerebro />
    </Suspense>
  );
}

function Cerebro() {
  const ws = useWs();
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>('mapa');
  const [bizArea, setBizArea] = useState('area-empresa');
  const [techArea, setTechArea] = useState('area-arquitetura');
  const [tableId, setTableId] = useState<string | null>(null);
  const mapApi = useRef<BrainMapApi | null>(null);
  const tableApi = useRef<DecisionTableApi | null>(null);

  // Deep links: ?regra=<id> abre a tabela; ?aba= e ?area= escolhem a vista.
  useEffect(() => {
    const regra = params.get('regra');
    const aba = params.get('aba') as Tab | null;
    const area = params.get('area');
    if (regra && ws.decisionTables.some((t) => t.id === regra)) {
      setTab('negocio');
      setBizArea('area-regras');
      setTableId(regra);
      return;
    }
    if (aba && ['mapa', 'negocio', 'tecnico'].includes(aba)) setTab(aba);
    if (area) {
      const a = ws.brainAreas.find((x) => x.id === area);
      if (a?.side === 'negocio') { setTab('negocio'); setBizArea(a.id); }
      if (a?.side === 'tecnico') { setTab('tecnico'); setTechArea(a.id); }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, ws.workspace.id]);

  // Troca de workspace: fecha a tabela aberta se ela não existir no novo.
  useEffect(() => {
    if (tableId && !ws.decisionTables.some((t) => t.id === tableId)) setTableId(null);
  }, [ws, tableId]);

  const openTable = useCallback((id: string) => {
    setTab('negocio');
    setBizArea('area-regras');
    setTableId(id);
    emitTourAction('regra.abrir');
  }, []);

  const openArea = (id: string) => {
    const a = ws.brainAreas.find((x) => x.id === id);
    if (!a) return;
    if (a.side === 'negocio') { setTab('negocio'); setBizArea(id); setTableId(null); }
    else { setTab('tecnico'); setTechArea(id); }
  };

  /** Garante a tabela do setor aberta e o painel montado. */
  const ensureShowcase = async () => {
    const id = showcaseTableId(ws);
    if (tableApi.current?.tableId === id) return;
    setTab('negocio');
    await sleep(350);
    setBizArea('area-regras');
    setTableId(id);
    for (let i = 0; i < 20 && tableApi.current?.tableId !== id; i++) await sleep(60);
  };

  useAutoAction('cerebro.acender', async () => {
    if (tab !== 'mapa') {
      setTab('mapa');
      await sleep(400);
    }
    for (let i = 0; i < 20 && !mapApi.current; i++) await sleep(50);
    await mapApi.current?.acender();
  });

  useAutoAction('regra.abrir', async () => {
    if (tab !== 'negocio') {
      setTab('negocio');
      await sleep(450);
    }
    setTableId(null);
    setBizArea('area-regras');
    await sleep(700);
    openTable(showcaseTableId(ws));
  });

  useAutoAction('regra.testar-caso', async () => {
    await ensureShowcase();
    await sleep(300);
    document.querySelector('[data-tour="regra-testar"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await sleep(400);
    await tableApi.current?.runTest({ reset: true });
  });

  useAutoAction('regra.publicar', async () => {
    await ensureShowcase();
    document.querySelector('[data-tour="regra-publicar"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await sleep(500);
    await tableApi.current?.publish();
  });

  return (
    <div>
      <PageHeader
        title="Cérebro"
        subtitle={`O que a ${ws.workspace.company} sabe, num só lugar: visão de negócio, regras em tabela de decisão e padrões técnicos. Todo item pode virar componente versionado no Catálogo.`}
      />
      <Tabs<Tab>
        className="mb-5"
        value={tab}
        onChange={(t) => setTab(t)}
        tabs={[
          { id: 'mapa', label: 'Mapa' },
          { id: 'negocio', label: 'Negócio' },
          { id: 'tecnico', label: 'Padrões técnicos' },
        ]}
      />
      {tab === 'mapa' && <BrainMap apiRef={mapApi} onOpenArea={openArea} />}
      {tab === 'negocio' && (
        <BusinessView
          area={bizArea}
          onArea={setBizArea}
          openTableId={tableId}
          onOpenTable={openTable}
          onCloseTable={() => setTableId(null)}
          tableApiRef={tableApi}
        />
      )}
      {tab === 'tecnico' && <TechView area={techArea} onArea={setTechArea} />}
    </div>
  );
}
