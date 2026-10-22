'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useCortex, useWs } from '@/lib/store';
import { emitTourAction, sleep, useAutoAction } from '@/lib/tour-bus';
import { Chip, PageHeader, Tabs } from '@/components/ui';
import { AgenticaView, DadosView, EngenhariaView, NegocioView, OperacaoView } from './Views';
import { EMPTY_FILTERS, TracesTab, type TraceFilters } from './TracesTab';
import { SuggestionsTab, acceptSuggestion } from './SuggestionsTab';

type Tab = 'operacao' | 'agentica' | 'engenharia' | 'negocio' | 'dados' | 'traces' | 'sugestoes';
const TABS: Tab[] = ['operacao', 'agentica', 'engenharia', 'negocio', 'dados', 'traces', 'sugestoes'];

export function TelemetriaView() {
  const params = useSearchParams();
  const ws = useWs();
  const initial = params.get('tab') as Tab | null;
  const [tab, setTab] = useState<Tab>(() =>
    initial && TABS.includes(initial) ? initial : useCortex.getState().tour.active ? 'traces' : 'operacao',
  );
  const [filters, setFilters] = useState<TraceFilters>(EMPTY_FILTERS);
  const [selectedExec, setSelectedExec] = useState<string | null>(params.get('trace'));
  const newSuggestions = ws.suggestions.filter((s) => s.status === 'nova').length;

  const selectTrace = (id: string) => setSelectedExec(id);

  // Piloto automático: abre o trace da primeira execução em que um guardrail agiu.
  useAutoAction('telemetria.abrir-trace-guardrail', async () => {
    const st = useCortex.getState();
    const data = st.activeWorkspaceId ? st.workspaces[st.activeWorkspaceId] : null;
    if (!data) return;
    setTab('traces');
    setFilters(EMPTY_FILTERS);
    await sleep(500);
    const target = data.executions.find((e) => e.guardrail);
    if (target) {
      setSelectedExec(target.id);
      await sleep(300);
      document.querySelector('[data-tour="telemetria-trace"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    await sleep(500);
    emitTourAction('telemetria.abrir-trace-guardrail');
  });

  // Piloto automático: aceita a primeira sugestão nova do cérebro.
  useAutoAction('sugestao.aceitar', async () => {
    const st = useCortex.getState();
    const data = st.activeWorkspaceId ? st.workspaces[st.activeWorkspaceId] : null;
    if (!data) return;
    setTab('sugestoes');
    await sleep(700);
    const target = data.suggestions.find((s) => s.status === 'nova');
    if (target) {
      document.querySelector('[data-tour="sugestao-aceitar"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await sleep(600);
      acceptSuggestion(target.id);
    }
    emitTourAction('sugestao.aceitar');
  });

  const onManualSelect = (id: string) => {
    selectTrace(id);
    const e = ws.executions.find((x) => x.id === id);
    if (e?.guardrail) emitTourAction('telemetria.abrir-trace-guardrail');
  };

  return (
    <div>
      <PageHeader
        title="Telemetria"
        subtitle="Do esforço ao valor: operação, agêntica, engenharia, negócio e dados, com o explorador de traces e as sugestões do cérebro."
      />
      <Tabs<Tab>
        className="mb-5 overflow-x-auto"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'operacao', label: 'Operação' },
          { id: 'agentica', label: 'Agêntica' },
          { id: 'engenharia', label: 'Engenharia' },
          { id: 'negocio', label: 'Negócio' },
          { id: 'dados', label: 'Dados' },
          { id: 'traces', label: <span data-tour={tab === 'traces' ? undefined : 'telemetria-trace'}>Traces</span> },
          {
            id: 'sugestoes',
            label: (
              <span className="inline-flex items-center gap-2" data-tour={tab === 'sugestoes' ? undefined : 'sugestao-aceitar'}>
                Sugestões {newSuggestions > 0 && <Chip tone="lilac">{newSuggestions}</Chip>}
              </span>
            ),
          },
        ]}
      />
      {tab === 'operacao' && <OperacaoView />}
      {tab === 'agentica' && <AgenticaView />}
      {tab === 'engenharia' && <EngenhariaView />}
      {tab === 'negocio' && <NegocioView />}
      {tab === 'dados' && <DadosView />}
      {tab === 'traces' && <TracesTab filters={filters} onFilters={setFilters} selectedId={selectedExec} onSelect={onManualSelect} />}
      {tab === 'sugestoes' && <SuggestionsTab />}
    </div>
  );
}
