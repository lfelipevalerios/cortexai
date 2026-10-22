'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { DEMO_IDS } from '@cortex/seed';
import { useCortex, useWs } from '@/lib/store';
import { emitTourAction, sleep, useAutoAction } from '@/lib/tour-bus';
import { PageHeader, Tabs, Chip } from '@/components/ui';
import { PoliciesTab } from './PoliciesTab';
import { ApprovalsTab } from './ApprovalsTab';
import { AuditTab } from './AuditTab';
import { RiskTab } from './RiskTab';
import { decideApproval } from './approvals-logic';

type Tab = 'politicas' | 'aprovacoes' | 'auditoria' | 'risco';
const TABS: Tab[] = ['politicas', 'aprovacoes', 'auditoria', 'risco'];

export function GovernancaView() {
  const params = useSearchParams();
  const ws = useWs();
  const initial = params.get('tab') as Tab | null;
  const [tab, setTab] = useState<Tab>(() =>
    initial && TABS.includes(initial) ? initial : useCortex.getState().tour.active ? 'aprovacoes' : 'politicas',
  );
  const [selectedApproval, setSelectedApproval] = useState<string | null>(() => {
    const fromUrl = params.get('aprovacao');
    if (fromUrl) return fromUrl;
    const anchorId = DEMO_IDS[ws.workspace.industry].anchorJourneyId;
    return ws.approvals.find((a) => a.kind === 'promocao' && a.status === 'pendente' && a.approverProfile === 'dono_negocio' && a.objectId.startsWith(`${anchorId}@`))?.id ?? null;
  });
  const [approvedJourneyId, setApprovedJourneyId] = useState<string | null>(null);
  const pending = ws.approvals.filter((a) => a.status === 'pendente').length;

  // Piloto automático: aprova, como dono de negócio, a promoção para Prd da jornada-âncora.
  useAutoAction('governanca.aprovar', async () => {
    const st = useCortex.getState();
    const data = st.activeWorkspaceId ? st.workspaces[st.activeWorkspaceId] : null;
    if (!data) return;
    setTab('aprovacoes');
    const anchorId = DEMO_IDS[data.workspace.industry].anchorJourneyId;
    const promos = data.approvals.filter((a) => a.kind === 'promocao' && a.status === 'pendente' && a.approverProfile === 'dono_negocio');
    const target = promos.find((a) => a.objectId.startsWith(`${anchorId}@`) && a.objectId.endsWith('->prd')) ?? promos.find((a) => a.objectId.startsWith(anchorId)) ?? promos[0];
    if (!target) {
      st.toast({ kind: 'info', title: 'Nenhuma promoção pendente', description: 'Não há pedido de promoção para Prd aguardando o dono de negócio.' });
      emitTourAction('governanca.aprovar');
      return;
    }
    await sleep(500);
    setSelectedApproval(target.id);
    if (useCortex.getState().profile !== 'dono_negocio') {
      await sleep(400);
      useCortex.getState().setProfile('dono_negocio');
    }
    await sleep(1100);
    const r = decideApproval(target.id, 'aprovado', 'Regras do domínio conferidas no Hml.');
    if (r?.journeyId) setApprovedJourneyId(r.journeyId);
    emitTourAction('governanca.aprovar');
  });

  return (
    <div>
      <PageHeader
        title="Governança"
        subtitle="Políticas agem no desenho, na promoção, na construção e na execução. Aprovações em fila única e trilha de auditoria imutável."
      />
      <Tabs<Tab>
        className="mb-5"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'politicas', label: 'Políticas' },
          { id: 'aprovacoes', label: <span className="inline-flex items-center gap-2" data-tour={tab === 'aprovacoes' ? undefined : 'governanca-aprovacoes'}>Aprovações {pending > 0 && <Chip tone="yellow">{pending}</Chip>}</span> },
          { id: 'auditoria', label: 'Auditoria' },
          { id: 'risco', label: 'Classificação de risco' },
        ]}
      />
      {tab === 'politicas' && <PoliciesTab />}
      {tab === 'aprovacoes' && (
        <ApprovalsTab
          selectedId={selectedApproval}
          onSelect={setSelectedApproval}
          approvedJourneyId={approvedJourneyId}
          onApprovedPromotion={setApprovedJourneyId}
        />
      )}
      {tab === 'auditoria' && <AuditTab />}
      {tab === 'risco' && <RiskTab />}
    </div>
  );
}
