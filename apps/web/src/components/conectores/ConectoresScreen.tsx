'use client';

// Módulo Conectores (seção 4): galeria, meus conectores, detalhe, wizard e importação OpenAPI.
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Plus, FileJson, Sparkles, X, LayoutDashboard, Brain, ExternalLink, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { Connector, ConnectorType } from '@cortex/schemas';
import { CONNECTOR_TYPES } from '@cortex/seed';
import { Button, Card, Chip, IconCircle, NoPermission, PageHeader, Tabs, useCan } from '@/components/ui';
import { demoNow, useCortex, useWs } from '@/lib/store';
import { emitTourAction, sleep, useAutoAction } from '@/lib/tour-bus';
import { Galeria } from './Galeria';
import { MeusConectores } from './MeusConectores';
import { DetalheConector, DuplicateModal, EditMappingModal, RemoveModal, TestModal } from './Detalhe';
import { OpenApiImport, type OpenApiHandle } from './OpenApiImport';
import { Wizard, useWizard, type WizardStep } from './Wizard';

type Tab = 'galeria' | 'meus';

function ParamsReader({ onParams }: { onParams: (id: string | null, novo: boolean) => void }) {
  const sp = useSearchParams();
  const id = sp.get('id');
  const novo = sp.get('novo') === '1';
  useEffect(() => {
    onParams(id, novo);
  }, [id, novo, onParams]);
  return null;
}

export function ConectoresScreen() {
  const ws = useWs();
  const canCreate = useCan('cadastrar_conector');
  const mutate = useCortex((s) => s.mutate);
  const toast = useCortex((s) => s.toast);
  const replace = useCortex((s) => s.replaceWorkspace);

  const [tab, setTab] = useState<Tab>('galeria');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [testC, setTestC] = useState<Connector | null>(null);
  const [dupC, setDupC] = useState<Connector | null>(null);
  const [editC, setEditC] = useState<Connector | null>(null);
  const [removeC, setRemoveC] = useState<Connector | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const openapiRef = useRef<OpenApiHandle | null>(null);
  const openapiAnchor = useRef<HTMLDivElement>(null);

  const onDone = useCallback((connId: string) => {
    setBanner(connId);
    setTab('meus');
  }, []);
  const wz = useWizard(onDone);
  const crmType = CONNECTOR_TYPES.find((t) => t.id === wz.preset.typeId)!;

  const onParams = useCallback(
    (id: string | null, novo: boolean) => {
      if (id) setDetailId(id);
      if (novo && !wz.ref.current.open) wz.openWith(null, 1);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const connect = (t: ConnectorType) => {
    if (!canCreate) return;
    setBanner(null);
    wz.openWith(t, 2);
    if (t.id === crmType.id) emitTourAction('wizard.abrir-crm');
  };

  const togglePause = (c: Connector) => {
    const pausing = c.status !== 'pausado';
    const before = mutate(
      (d) => {
        const x = d.connectors.find((k) => k.id === c.id);
        if (!x) return;
        x.status = pausing ? 'pausado' : 'conectado';
        x.logs = [...x.logs, { at: demoNow(), level: pausing ? 'aviso' : 'info', message: pausing ? 'Sincronização pausada manualmente.' : 'Sincronização retomada.' }];
      },
      { action: pausing ? 'Pausou conector' : 'Retomou conector', object: c.name },
    );
    toast({
      kind: pausing ? 'aviso' : 'sucesso',
      title: pausing ? `${c.name} pausado` : `${c.name} retomado`,
      description: pausing ? `${c.consumers.length} consumidores deixam de receber atualizações até a retomada.` : undefined,
      undo: before ? () => replace(before) : undefined,
    });
  };

  const scrollToOpenApi = () => openapiAnchor.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // ---------- Piloto automático ----------
  const ensureCrmOpen = async (step: WizardStep) => {
    const d = wz.ref.current;
    if (!d.open || d.typeId !== crmType.id) {
      setBanner(null);
      wz.openWith(crmType, step);
      await sleep(350);
    }
  };

  const fill = async (fast: boolean) => {
    await ensureCrmOpen(2);
    wz.goStep(2);
    await sleep(fast ? 60 : 450);
    // "Digita" rápido, alguns caracteres por vez, para a plateia ver o campo sendo preenchido.
    const typeInto = async (key: 'endpoint' | 'identity' | 'secretDraft', value: string, step: number, delay: number) => {
      if (!fast) {
        for (let i = step; i < value.length; i += step) {
          wz.set({ [key]: value.slice(0, i) });
          await sleep(delay);
        }
      }
      wz.set({ [key]: value });
    };
    await typeInto('endpoint', wz.preset.endpoint, 3, 22);
    await sleep(fast ? 0 : 350);
    wz.set({ auth: crmType.auth });
    await sleep(fast ? 0 : 250);
    await typeInto('identity', 'cortex-demo-app', 2, 25);
    // Valor fictício: o campo é de senha e o valor é descartado ao enviar ao cofre.
    await typeInto('secretDraft', 'demo'.repeat(5), 3, 30);
    await sleep(fast ? 0 : 400);
    await wz.sendToVault();
  };

  const ensureTested = async (fast: boolean): Promise<boolean> => {
    const d = wz.ref.current;
    if (!d.open || d.typeId !== crmType.id || !d.secretRef || !d.endpoint) await fill(fast);
    if (wz.ref.current.testStatus === 'ok') return true;
    wz.goStep(3);
    return wz.runTests();
  };

  const ensureDiscovered = async (fast: boolean): Promise<boolean> => {
    if (!(await ensureTested(fast))) return false;
    if (wz.ref.current.discovery === 'ok') return true;
    wz.goStep(4);
    await wz.runDiscovery();
    const after: string = wz.ref.current.discovery;
    return after === 'ok';
  };

  const guard = () => {
    if (canCreate) return true;
    toast({ kind: 'aviso', title: 'Seu perfil não pode cadastrar conectores', description: 'Use "Ver como" com Champion AI ou Engenheiro de dados.' });
    return false;
  };

  useAutoAction('wizard.abrir-crm', async () => {
    if (!guard()) return;
    setBanner(null);
    setTab('galeria');
    if (wz.ref.current.open) wz.close();
    await sleep(250);
    document.querySelector('[data-tour="conector-card-crm"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await sleep(600);
    wz.openWith(crmType, 1);
    await sleep(1100);
    wz.goStep(2);
    emitTourAction('wizard.abrir-crm');
  });

  useAutoAction('wizard.preencher', async () => {
    if (!guard()) return;
    await fill(false);
  });

  useAutoAction('wizard.testar', async () => {
    if (!guard()) return;
    const d = wz.ref.current;
    if (!d.open || d.typeId !== crmType.id || !d.secretRef) await fill(true);
    await sleep(250);
    wz.set({ testStatus: wz.ref.current.testStatus === 'rodando' ? 'rodando' : 'idle' });
    wz.goStep(3);
    await wz.runTests();
  });

  useAutoAction('wizard.descobrir', async () => {
    if (!guard()) return;
    if (!(await ensureTested(true))) return;
    await sleep(250);
    wz.goStep(4);
    await wz.runDiscovery();
  });

  useAutoAction('wizard.concluir', async () => {
    if (!guard()) return;
    if (!(await ensureDiscovered(true))) return;
    wz.goStep(5);
    await sleep(1200);
    await wz.conclude();
  });

  useAutoAction('openapi.importar-exemplo', async () => {
    if (wz.ref.current.open) {
      wz.close();
      await sleep(300);
    }
    await openapiRef.current?.runExample();
  });

  const bannerConn = banner ? ws.connectors.find((c) => c.id === banner) : undefined;
  const bannerIsCrm = !!bannerConn && bannerConn.typeId === crmType.id;
  const degraded = ws.connectors.filter((c) => c.status === 'degradado' || c.status === 'erro').length;

  return (
    <div className="space-y-5">
      <Suspense fallback={null}>
        <ParamsReader onParams={onParams} />
      </Suspense>

      <PageHeader
        title="Conectores"
        subtitle="Ligam o cérebro ao ecossistema. Cadastrar um sistema leva 5 passos guiados e todo conector já nasce exposto como tool para agentes, com política de uso."
        actions={
          <>
            <Button variant="tertiary" icon={FileJson} onClick={scrollToOpenApi}>Importar OpenAPI</Button>
            <Button variant="primary" icon={Plus} disabled={!canCreate} onClick={() => { setBanner(null); wz.openWith(null, 1); }}>Novo conector</Button>
          </>
        }
      >
        <div className="mt-2 flex flex-wrap gap-2">
          <Chip tone="green" icon={CheckCircle2}>{ws.connectors.filter((c) => c.status === 'conectado').length} conectados</Chip>
          {degraded > 0 && <Chip tone="yellow" icon={AlertTriangle}>{degraded} com atenção</Chip>}
          <Chip tone="muted">{ws.connectors.reduce((n, c) => n + c.tools.length, 0)} tools expostas</Chip>
        </div>
      </PageHeader>

      {!canCreate && <NoPermission action="cadastrar_conector" />}

      {bannerConn && !wz.data.open && (
        <Card halo="green" className="flex flex-wrap items-center gap-4 p-4">
          <IconCircle icon={Sparkles} tone="green" size="lg" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">{bannerConn.name} conectado</div>
            <p className="text-sm text-text-muted">
              {bannerIsCrm
                ? 'O conector apareceu no Mapa do ecossistema e o nó do cérebro ganhou brilho.'
                : 'O conector já aparece em Meus conectores, com as tools expostas para agentes.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="tertiary" icon={ExternalLink} onClick={() => setDetailId(bannerConn.id)}>Abrir conector</Button>
            <Link href="/cockpit"><Button size="sm" variant="tertiary" icon={LayoutDashboard}>Ver no Mapa do ecossistema</Button></Link>
            <Link href="/cerebro"><Button size="sm" variant="tertiary" icon={Brain}>Ver no cérebro</Button></Link>
            <Button size="sm" variant="ghost" icon={X} onClick={() => setBanner(null)} aria-label="Fechar aviso" />
          </div>
        </Card>
      )}

      {wz.data.open ? (
        canCreate ? <Wizard api={wz} /> : <NoPermission action="cadastrar_conector" />
      ) : (
        <>
          <Tabs<Tab>
            value={tab}
            onChange={setTab}
            tabs={[
              { id: 'galeria', label: 'Galeria' },
              { id: 'meus', label: `Meus conectores (${ws.connectors.length})` },
            ]}
          />
          {tab === 'galeria' ? (
            <Galeria crmTypeId={crmType.id} canCreate={canCreate} onConnect={connect} />
          ) : (
            <MeusConectores
              highlightId={banner}
              canCreate={canCreate}
              onNew={() => wz.openWith(null, 1)}
              actions={{ open: (c) => setDetailId(c.id), togglePause, test: setTestC, duplicate: setDupC }}
            />
          )}
          <div ref={openapiAnchor} className="scroll-mt-4">
            <OpenApiImport handleRef={openapiRef} canCreate={canCreate} onCreated={(id) => { setTab('meus'); setBanner(id); }} />
          </div>
        </>
      )}

      <DetalheConector
        id={detailId}
        onClose={() => setDetailId(null)}
        canEdit={canCreate}
        cb={{ onTest: setTestC, onDuplicate: setDupC, onEdit: setEditC, onRemove: setRemoveC }}
      />
      <TestModal c={testC} onClose={() => setTestC(null)} />
      {dupC && <DuplicateModal c={ws.connectors.find((x) => x.id === dupC.id) ?? null} onClose={() => setDupC(null)} />}
      {editC && <EditMappingModal c={ws.connectors.find((x) => x.id === editC.id) ?? null} onClose={() => setEditC(null)} />}
      {removeC && (
        <RemoveModal
          c={ws.connectors.find((x) => x.id === removeC.id) ?? null}
          onClose={() => setRemoveC(null)}
          onRemoved={() => {
            setRemoveC(null);
            setDetailId(null);
            if (banner === removeC.id) setBanner(null);
          }}
        />
      )}
    </div>
  );
}
