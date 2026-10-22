'use client';

// Wizard de cadastro de conector: 5 passos (escolher, configurar, testar, descobrir, mapear).
import { useCallback, useEffect, useReducer, useRef } from 'react';
import {
  Check, ChevronLeft, ChevronRight, Lock, Save, Vault, RefreshCw, Loader2, ScanSearch, Info, ShieldAlert, X, KeyRound, Wrench,
} from 'lucide-react';
import {
  CONNECTOR_CATEGORIES, ENVS, type AuthMethod, type Connector, type ConnectorCategory, type ConnectorTool, type ConnectorType,
  type DiscoveredObject, type EnvId, type SyncMode,
} from '@cortex/schemas';
import { CONNECTOR_TYPES, DEMO_IDS, CRM_WIZARD_PRESET } from '@cortex/seed';
import { formatNumber } from '@cortex/engine';
import { Button, Card, Chip, EnvBadge, Field, IconCircle, Input, Mono, Progress, Select, cx } from '@/components/ui';
import { demoNow, useCortex, useEnv, useWs } from '@/lib/store';
import { emitTourAction, sleep } from '@/lib/tour-bus';
import {
  AUTH_LABEL, BADGE_TONE, CATEGORY_ICON, PREFIX, SYNC_LABEL, genericObjects, genericTools, nextConnectorId, planChecks,
  secretRefFor, type CheckResult,
} from './helpers';
import { ChecksList, ModeChip, ObjectsView } from './parts';

export type WizardStep = 1 | 2 | 3 | 4 | 5;

export interface WizardData {
  open: boolean;
  step: WizardStep;
  category: ConnectorCategory | 'todas';
  typeId: string | null;
  connId: string;
  name: string;
  endpoint: string;
  auth: AuthMethod;
  env: EnvId;
  identity: string;
  /** Valor digitado; nunca exibido e descartado ao enviar ao cofre. */
  secretDraft: string;
  secretRef: string | null;
  vault: 'idle' | 'enviando';
  checks: CheckResult[];
  testStatus: 'idle' | 'rodando' | 'ok' | 'falha';
  discovery: 'idle' | 'rodando' | 'ok';
  discoveryPhase: number;
  objects: DiscoveredObject[];
  tools: ConnectorTool[];
  domainId: string;
  syncMode: SyncMode;
  toolSel: Record<string, boolean>;
  saving: boolean;
}

const STEPS: { n: WizardStep; label: string; hint: string }[] = [
  { n: 1, label: 'Escolher o sistema', hint: 'Categoria e produto' },
  { n: 2, label: 'Configurar a conexão', hint: 'Endereço, autenticação e ambiente' },
  { n: 3, label: 'Testar a conexão', hint: 'Rede, autenticação, permissão e latência' },
  { n: 4, label: 'Descobrir o esquema', hint: 'Objetos, contagens e amostra' },
  { n: 5, label: 'Mapear e sincronizar', hint: 'Domínio, modo e tools' },
];

const DISCOVERY_PHASES = ['Lendo metadados', 'Contando registros', 'Coletando amostra de 10 linhas', 'Classificando dados pessoais (PII)'];

function blank(env: EnvId): WizardData {
  return {
    open: false, step: 1, category: 'todas', typeId: null, connId: '', name: '', endpoint: '', auth: 'oauth2',
    env: env === 'prd' ? 'dev' : env, identity: '', secretDraft: '', secretRef: null, vault: 'idle',
    checks: [], testStatus: 'idle', discovery: 'idle', discoveryPhase: 0, objects: [], tools: [],
    domainId: '', syncMode: 'agendado', toolSel: {}, saving: false,
  };
}

/** Estado e operações do wizard. Vive na página para o piloto automático alcançar tudo. */
export function useWizard(onDone: (connId: string) => void) {
  const ws = useWs();
  const env = useEnv();
  const mutate = useCortex((s) => s.mutate);
  const toast = useCortex((s) => s.toast);
  const industry = ws.workspace.industry;
  const p = PREFIX[industry];
  const preset = CRM_WIZARD_PRESET[industry];
  const ref = useRef<WizardData>(blank(env));
  const [, bump] = useReducer((x: number) => x + 1, 0);
  const wsRef = useRef(ws);
  wsRef.current = ws;
  const testsP = useRef<Promise<boolean> | null>(null);
  const discP = useRef<Promise<void> | null>(null);

  const set = useCallback((patch: Partial<WizardData>) => {
    const prev = ref.current;
    let next = { ...prev, ...patch };
    // Mudou algo da conexão: o teste e a descoberta precisam rodar de novo.
    if (['endpoint', 'auth', 'env', 'secretRef', 'typeId'].some((k) => k in patch && (patch as Record<string, unknown>)[k] !== (prev as unknown as Record<string, unknown>)[k])) {
      next = { ...next, checks: [], testStatus: 'idle', ...(('typeId' in patch && patch.typeId !== prev.typeId) ? { discovery: 'idle' as const, objects: [], tools: [] } : {}) };
    }
    ref.current = next;
    bump();
  }, []);

  const isCrm = (typeId: string | null) => typeId === preset.typeId;

  const connIdFor = (typeId: string) =>
    isCrm(typeId) ? `${p}-cn-crm` : nextConnectorId(wsRef.current, `${p}-cn-${typeId}`);

  const choose = useCallback((t: ConnectorType) => {
    const crm = t.id === preset.typeId;
    const connId = connIdFor(t.id);
    set({
      typeId: t.id, category: t.category, connId, name: crm ? preset.name : t.name, auth: t.auth, endpoint: '',
      identity: '', secretDraft: '', secretRef: null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [set, preset]);

  const openWith = useCallback((t: ConnectorType | null, step: WizardStep) => {
    ref.current = { ...blank(useCortex.getState().env), open: true, step: t ? step : 1 };
    bump();
    if (t) choose(t);
  }, [choose]);

  const close = useCallback(() => {
    ref.current = { ...ref.current, open: false };
    bump();
  }, []);

  const goStep = useCallback((n: WizardStep) => set({ step: n }), [set]);

  const sendToVault = useCallback(async () => {
    const d = ref.current;
    if (!d.typeId) return;
    set({ vault: 'enviando' });
    await sleep(700);
    set({ vault: 'idle', secretDraft: '', secretRef: secretRefFor(wsRef.current.workspace.id, ref.current.connId, ref.current.env) });
    emitTourAction('wizard.preencher');
  }, [set]);

  const runTests = useCallback((): Promise<boolean> => {
    if (testsP.current) return testsP.current;
    const run = async () => {
      const d = ref.current;
      const plan = planChecks(d.endpoint, !!d.secretRef, isCrm(d.typeId) ? 236 : undefined);
      set({ testStatus: 'rodando', checks: plan.map((c) => ({ key: c.key, status: 'pendente' })) });
      for (let i = 0; i < plan.length; i++) {
        const r = plan[i];
        if (r.status === 'pendente') break;
        ref.current = { ...ref.current, checks: ref.current.checks.map((c, j) => (j === i ? { ...c, status: 'rodando' } : c)) };
        bump();
        await sleep(Math.min(900, 380 + (r.ms ?? 200)));
        ref.current = { ...ref.current, checks: ref.current.checks.map((c, j) => (j === i ? r : c)) };
        bump();
        if (r.status === 'falha') {
          set({ testStatus: 'falha' });
          return false;
        }
      }
      set({ testStatus: 'ok' });
      emitTourAction('wizard.testar');
      return true;
    };
    testsP.current = run().finally(() => {
      testsP.current = null;
    });
    return testsP.current;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [set, preset]);

  const runDiscovery = useCallback((): Promise<void> => {
    if (discP.current) return discP.current;
    const run = async () => {
      const d = ref.current;
      const type = CONNECTOR_TYPES.find((t) => t.id === d.typeId);
      if (!type) return;
      set({ discovery: 'rodando', discoveryPhase: 0 });
      for (let i = 0; i < DISCOVERY_PHASES.length; i++) {
        set({ discoveryPhase: i });
        await sleep(380);
      }
      const crm = isCrm(type.id);
      const objects = crm ? preset.objects : genericObjects(type);
      const tools = crm ? preset.tools : genericTools(p, d.connId, objects);
      const w = wsRef.current;
      set({
        discovery: 'ok', objects, tools,
        toolSel: Object.fromEntries(tools.map((t) => [t.id, true])),
        domainId: crm ? preset.domainId : (w.domains.find((x) => x.kind === 'negocio')?.id ?? w.domains[0]?.id ?? ''),
        syncMode: crm || type.category === 'banco' ? 'cdc' : type.category === 'api' || type.category === 'mcp' ? 'sob_demanda' : 'agendado',
      });
      emitTourAction('wizard.descobrir');
    };
    discP.current = run().finally(() => {
      discP.current = null;
    });
    return discP.current;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [set, preset, p]);

  const buildConnector = (status: Connector['status']): Connector => {
    const d = ref.current;
    const lat = d.checks.find((c) => c.key === 'latencia')?.ms ?? 0;
    const now = demoNow();
    const tools = d.tools
      .filter((t) => d.toolSel[t.id])
      .map((t) => ({ ...t, enabledByEnv: { dev: true, hml: true, prd: t.mode === 'leitura' ? t.enabledByEnv.prd : false } }));
    const pii = d.objects.reduce((n, o) => n + o.fields.filter((f) => f.pii).length, 0);
    return {
      id: d.connId,
      typeId: d.typeId!,
      name: d.name.trim() || d.connId,
      status,
      envs: d.secretRef ? { [d.env]: { endpoint: d.endpoint.trim(), secretRef: d.secretRef } } : {},
      ...(d.domainId ? { domainId: d.domainId } : {}),
      syncMode: d.syncMode,
      lastSync: now,
      volume: d.objects.reduce((n, o) => n + o.records, 0),
      latencyMs: lat,
      consumers: [],
      objects: d.objects,
      tools,
      logs:
        status === 'rascunho'
          ? [{ at: now, level: 'info', message: 'Rascunho salvo pelo wizard.' }]
          : [
              { at: now, level: 'info', message: `Conector criado pelo wizard em ${ENVS[d.env].label}; credencial guardada no cofre.` },
              { at: now, level: 'info', message: 'Teste de saúde: rede, autenticação, permissão e latência ok.' },
              { at: now, level: 'info', message: `Descoberta: ${d.objects.length} objetos; ${pii} campos PII marcados e mascarados.` },
            ],
    };
  };

  const conclude = useCallback(async () => {
    const d = ref.current;
    if (!d.typeId || d.discovery !== 'ok') return;
    set({ saving: true });
    await sleep(650);
    const c = buildConnector('conectado');
    const crm = isCrm(d.typeId);
    const demo = DEMO_IDS[industry];
    mutate(
      (draft) => {
        draft.connectors = [c, ...draft.connectors.filter((x) => x.id !== c.id)];
        if (crm) {
          const sys = draft.systems.find((s) => s.id === demo.crmSystemId);
          if (sys) sys.connectorId = c.id;
          const comp = draft.components.find((x) => x.id === `${p}-cp-mcp-crm`);
          if (comp) comp.status = 'em_revisao';
        }
      },
      { action: 'Cadastrou conector', object: c.name },
    );
    ref.current = { ...ref.current, saving: false, open: false };
    bump();
    toast({ kind: 'sucesso', title: `${c.name} conectado em ${ENVS[d.env].label}`, description: `${c.tools.length} tools expostas para agentes; escrita desligada em Prd.` });
    onDone(c.id);
    emitTourAction('wizard.concluir');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [set, mutate, toast, industry, p, onDone]);

  const saveDraft = useCallback(() => {
    const d = ref.current;
    if (!d.typeId) return;
    const c = buildConnector('rascunho');
    mutate((draft) => {
      draft.connectors = [c, ...draft.connectors.filter((x) => x.id !== c.id)];
    }, { action: 'Salvou rascunho de conector', object: c.name });
    close();
    toast({ kind: 'info', title: 'Rascunho salvo', description: `${c.name} aparece em Meus conectores como Rascunho.` });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mutate, toast, close]);

  return { data: ref.current, ref, set, choose, openWith, close, goStep, sendToVault, runTests, runDiscovery, conclude, saveDraft, preset, isCrm };
}

export type WizardApi = ReturnType<typeof useWizard>;

// ---------- Visual ----------
export function Wizard({ api }: { api: WizardApi }) {
  const globalEnv = useEnv();
  const setEnv = useCortex((s) => s.setEnv);
  const { data: d, set, goStep, runTests, runDiscovery } = api;
  const type = CONNECTOR_TYPES.find((t) => t.id === d.typeId) ?? null;

  // Entrar no passo 3 ou 4 dispara a checagem/descoberta automaticamente.
  useEffect(() => {
    if (!d.open) return;
    if (d.step === 3 && d.testStatus === 'idle') void runTests();
    if (d.step === 4 && d.discovery === 'idle' && d.testStatus === 'ok') void runDiscovery();
  }, [d.open, d.step, d.testStatus, d.discovery, runTests, runDiscovery]);

  const canNext =
    (d.step === 1 && !!d.typeId) ||
    (d.step === 2 && !!d.endpoint.trim() && !!d.secretRef && d.vault === 'idle') ||
    (d.step === 3 && d.testStatus === 'ok') ||
    (d.step === 4 && d.discovery === 'ok');

  const stepDone = (n: WizardStep) =>
    (n === 1 && !!d.typeId) || (n === 2 && !!d.secretRef) || (n === 3 && d.testStatus === 'ok') || (n === 4 && d.discovery === 'ok');

  const tourFor = (n: WizardStep) => (n === 2 ? 'wizard-passo-config' : n === 3 ? 'wizard-passo-teste' : n === 4 ? 'wizard-descoberta' : undefined);

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
        <div className="min-w-0">
          <div className="text-base font-semibold">Novo conector{type ? ` · ${type.name}` : ''}</div>
          <div className="text-xs text-text-muted">Passo {d.step} de 5 · {STEPS[d.step - 1].label}</div>
        </div>
        <Button variant="ghost" size="sm" icon={X} onClick={api.close}>Fechar</Button>
      </div>
      <div className="px-5 pt-3">
        <Progress value={(d.step / 5) * 100} tone="purple" />
      </div>

      {globalEnv === 'prd' && (
        <div className="mx-5 mt-3 flex flex-wrap items-center gap-3 rounded-card border border-warning/40 bg-warning/5 px-4 py-3">
          <Lock className="h-5 w-5 shrink-0 text-warning" strokeWidth={1.5} />
          <p className="min-w-0 flex-1 text-sm">
            Você está em <strong>Prd</strong>. Um conector em Prd só é criado por promoção a partir de Hml, nunca direto. Crie em Dev ou Hml e promova depois.
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="tertiary" onClick={() => { setEnv('dev'); set({ env: 'dev', secretRef: null }); }}>Criar em Dev</Button>
            <Button size="sm" variant="tertiary" onClick={() => { setEnv('hml'); set({ env: 'hml', secretRef: null }); }}>Criar em Hml</Button>
          </div>
        </div>
      )}

      <div className="grid gap-0 lg:grid-cols-[230px_1fr_280px]">
        {/* Passos numerados */}
        <ol className="space-y-1 border-b border-border p-4 lg:border-b-0 lg:border-r">
          {STEPS.map((s) => {
            const active = d.step === s.n;
            const done = stepDone(s.n) && !active;
            const reachable = s.n <= d.step || STEPS.slice(0, s.n - 1).every((x) => stepDone(x.n));
            return (
              <li key={s.n} data-tour={!active ? tourFor(s.n) : undefined}>
                <button
                  disabled={!reachable}
                  onClick={() => goStep(s.n)}
                  className={cx(
                    'flex w-full items-start gap-3 rounded-field px-2 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                    active ? 'bg-accent/10' : 'hover:bg-surface-2',
                  )}
                >
                  <span
                    className={cx(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
                      active && 'border-accent bg-accent text-white shadow-halo-purple',
                      done && 'border-primary bg-primary/10 text-primary',
                      !active && !done && 'border-border text-text-muted',
                    )}
                  >
                    {done ? <Check className="h-4 w-4" /> : s.n}
                  </span>
                  <span className="min-w-0">
                    <span className={cx('block text-sm', active ? 'font-semibold text-text' : 'text-text-muted')}>{s.label}</span>
                    <span className="block text-[11px] text-text-muted">{s.hint}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        {/* Conteúdo */}
        <div className="min-w-0 p-5" data-tour={tourFor(d.step)}>
          {d.step === 1 && <StepChoose api={api} />}
          {d.step === 2 && <StepConfig api={api} />}
          {d.step === 3 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold">Testar a conexão</h3>
                  <p className="text-sm text-text-muted">Quatro checagens em sequência antes de qualquer dado ser usado.</p>
                </div>
                <Button size="sm" variant="tertiary" icon={RefreshCw} loading={d.testStatus === 'rodando'} onClick={() => { set({ testStatus: 'idle', checks: [] }); }}>
                  Testar novamente
                </Button>
              </div>
              <ChecksList results={d.checks} />
              {d.testStatus === 'ok' && (
                <p className="text-sm text-primary">Conexão saudável em {formatNumber(d.checks.reduce((n, c) => n + (c.ms ?? 0), 0))} ms no total.</p>
              )}
              {d.testStatus === 'falha' && (
                <Button size="sm" variant="tertiary" icon={ChevronLeft} onClick={() => goStep(2)}>Voltar à configuração</Button>
              )}
            </div>
          )}
          {d.step === 4 && (
            <div className="space-y-3">
              <div>
                <h3 className="text-base font-semibold">Descobrir o esquema</h3>
                <p className="text-sm text-text-muted">Objetos, contagem de registros e amostra de 10 linhas. Campos pessoais aparecem mascarados e marcados como PII.</p>
              </div>
              {d.discovery === 'rodando' && (
                <div className="space-y-2 rounded-card border border-accent/40 p-4">
                  {DISCOVERY_PHASES.map((ph, i) => (
                    <div key={ph} className={cx('flex items-center gap-2 text-sm', i > d.discoveryPhase && 'text-text-muted opacity-50')}>
                      {i < d.discoveryPhase ? <Check className="h-4 w-4 text-primary" /> : i === d.discoveryPhase ? <Loader2 className="h-4 w-4 animate-spin text-accent" /> : <ScanSearch className="h-4 w-4" strokeWidth={1.5} />}
                      {ph}
                    </div>
                  ))}
                </div>
              )}
              {d.discovery === 'idle' && d.testStatus !== 'ok' && (
                <p className="text-sm text-text-muted">Rode o teste de conexão antes da descoberta.</p>
              )}
              {d.discovery === 'ok' && (
                <>
                  <div className="flex flex-wrap gap-2">
                    <Chip tone="purple">{d.objects.length} objetos</Chip>
                    <Chip tone="muted">{formatNumber(d.objects.reduce((n, o) => n + o.records, 0))} registros</Chip>
                    <Chip tone="red" icon={ShieldAlert}>{d.objects.reduce((n, o) => n + o.fields.filter((f) => f.pii).length, 0)} campos PII mascarados</Chip>
                  </div>
                  <ObjectsView objects={d.objects} />
                </>
              )}
            </div>
          )}
          {d.step === 5 && <StepMap api={api} />}
        </div>

        {/* Resumo */}
        <aside className="space-y-3 border-t border-border bg-surface-2/40 p-4 text-sm lg:border-l lg:border-t-0">
          <div className="text-xs font-semibold uppercase tracking-wide text-text-muted">Resumo</div>
          <SummaryRow label="Sistema" value={type ? type.name : '—'} />
          <SummaryRow label="Nome" value={d.name || '—'} />
          <SummaryRow label="Endereço" value={d.endpoint ? <Mono className="break-all">{d.endpoint}</Mono> : '—'} />
          <SummaryRow label="Autenticação" value={AUTH_LABEL[d.auth]} />
          <SummaryRow label="Ambiente" value={<EnvBadge env={d.env} />} />
          <SummaryRow label="Credencial" value={d.secretRef ? <Mono className="break-all text-primary">{d.secretRef}</Mono> : <span className="text-text-muted">ainda não está no cofre</span>} />
          <SummaryRow
            label="Teste"
            value={d.testStatus === 'ok' ? <Chip tone="green" icon={Check}>4 de 4 ok</Chip> : d.testStatus === 'falha' ? <Chip tone="red">Falhou</Chip> : d.testStatus === 'rodando' ? <Chip tone="lilac" icon={Loader2}>Rodando</Chip> : '—'}
          />
          <SummaryRow label="Objetos" value={d.discovery === 'ok' ? `${d.objects.length} descobertos` : '—'} />
          {d.discovery === 'ok' && (
            <SummaryRow label="Tools" value={`${Object.values(d.toolSel).filter(Boolean).length} de ${d.tools.length} selecionadas`} />
          )}
          <p className="border-t border-border pt-3 text-xs text-text-muted">
            <KeyRound className="mr-1 inline h-3.5 w-3.5" strokeWidth={1.5} />
            O segredo fica no cofre. O Córtex guarda e mostra só a referência.
          </p>
        </aside>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-5 py-3">
        <Button variant="ghost" icon={ChevronLeft} disabled={d.step === 1} onClick={() => goStep((d.step - 1) as WizardStep)}>Voltar</Button>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="tertiary" icon={Save} disabled={!d.typeId} onClick={api.saveDraft}>Salvar rascunho</Button>
          {d.step < 5 && (
            <Button variant={d.step === 4 ? 'tertiary' : 'primary'} disabled={!canNext} onClick={() => goStep((d.step + 1) as WizardStep)}>
              Avançar <ChevronRight className="h-4 w-4" />
            </Button>
          )}
          {d.step >= 4 && (
            <Button data-tour="wizard-concluir" variant="primary" icon={Check} loading={d.saving} disabled={d.discovery !== 'ok'} onClick={() => void api.conclude()}>
              Concluir
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] text-text-muted">{label}</div>
      <div className="mt-0.5 min-w-0">{value}</div>
    </div>
  );
}

function StepChoose({ api }: { api: WizardApi }) {
  const ws = useWs();
  const { data: d, set, choose, preset } = api;
  const types = CONNECTOR_TYPES.filter((t) => !t.industry || t.industry === ws.workspace.industry);
  const cats = (Object.keys(CONNECTOR_CATEGORIES) as ConnectorCategory[]).filter((c) => types.some((t) => t.category === c));
  const list = types.filter((t) => d.category === 'todas' || t.category === d.category);
  const sel = types.find((t) => t.id === d.typeId);
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Escolher o sistema</h3>
        <p className="text-sm text-text-muted">Categoria e produto. O wizard sugere o método de autenticação padrão do sistema.</p>
      </div>
      <Field label="Categoria">
        <Select
          value={d.category}
          onChange={(e) => set({ category: e.target.value as WizardData['category'] })}
          options={[{ value: 'todas', label: 'Todas as categorias' }, ...cats.map((c) => ({ value: c, label: CONNECTOR_CATEGORIES[c] }))]}
        />
      </Field>
      <div className="grid gap-2 sm:grid-cols-2">
        {list.map((t) => {
          const Icon = CATEGORY_ICON[t.category];
          const active = t.id === d.typeId;
          return (
            <button
              key={t.id}
              onClick={() => choose(t)}
              className={cx(
                'flex items-center gap-3 rounded-card border px-3 py-2.5 text-left transition-colors',
                active ? 'border-accent bg-accent/10 shadow-halo-purple' : 'border-border hover:bg-surface-2',
              )}
            >
              <Icon className="h-5 w-5 shrink-0 text-accent" strokeWidth={1.5} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{t.name}</span>
                <span className="block text-[11px] text-text-muted">{CONNECTOR_CATEGORIES[t.category]} · {AUTH_LABEL[t.auth]}</span>
              </span>
              <Chip tone={BADGE_TONE[t.badge]}>{t.badge}</Chip>
              {t.id === preset.typeId && <Chip tone="purple">CRM da empresa</Chip>}
            </button>
          );
        })}
      </div>
      {sel && (
        <div className="flex items-start gap-3 rounded-card border border-accent/40 bg-accent/5 p-3 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent" strokeWidth={1.5} />
          <span>
            <strong>{sel.name}</strong>: autenticação sugerida <strong>{AUTH_LABEL[sel.auth]}</strong>. {sel.description}
          </span>
        </div>
      )}
    </div>
  );
}

const ENDPOINT_PLACEHOLDER: Partial<Record<ConnectorCategory, string>> = {
  banco: 'postgresql://host:5432/banco',
  eventos: 'kafka://broker:9093',
  mcp: 'https://mcp.exemplo.com.br/sse',
};

function StepConfig({ api }: { api: WizardApi }) {
  const { data: d, set, sendToVault } = api;
  const type = CONNECTOR_TYPES.find((t) => t.id === d.typeId);
  const idLabel = d.auth === 'oauth2' ? 'ID do cliente (client_id)' : d.auth === 'usuario_senha' ? 'Usuário' : d.auth === 'certificado' ? 'Arquivo do certificado (.pem)' : null;
  const secretLabel = d.auth === 'oauth2' ? 'Segredo do cliente' : d.auth === 'usuario_senha' ? 'Senha' : d.auth === 'certificado' ? 'Chave privada' : 'Chave de API';
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Configurar a conexão</h3>
        <p className="text-sm text-text-muted">Endereço, método de autenticação e ambiente. A credencial vai para o cofre; a tela só mostra a referência do segredo.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Nome do conector">
          <Input value={d.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field label="Método de autenticação" hint={type ? `Sugerido para ${type.name}: ${AUTH_LABEL[type.auth]}` : undefined}>
          <Select value={d.auth} onChange={(e) => set({ auth: e.target.value as AuthMethod, secretRef: null, secretDraft: '' })} options={(Object.keys(AUTH_LABEL) as AuthMethod[]).map((a) => ({ value: a, label: AUTH_LABEL[a] }))} />
        </Field>
      </div>
      <Field label="Endereço (endpoint)" hint="Use o endereço completo com https://. Sem o protocolo, a checagem de rede falha e mostra como corrigir.">
        <Input value={d.endpoint} placeholder={(type && ENDPOINT_PLACEHOLDER[type.category]) ?? 'https://api.exemplo.com.br/v1'} onChange={(e) => set({ endpoint: e.target.value })} className="font-mono" />
      </Field>
      <div>
        <span className="mb-1 block text-xs font-medium text-text-muted">Ambiente</span>
        <div className="flex flex-wrap gap-2">
          {(['dev', 'hml', 'prd'] as EnvId[]).map((e) => (
            <button
              key={e}
              disabled={e === 'prd'}
              onClick={() => e !== d.env && set({ env: e, secretRef: null })}
              title={e === 'prd' ? 'Prd só por promoção a partir de Hml' : undefined}
              className={cx(
                'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                d.env === e ? 'border-primary bg-primary/10' : 'border-border hover:bg-surface-2',
              )}
            >
              <EnvBadge env={e} />
              {e === 'prd' ? <span className="flex items-center gap-1 text-text-muted"><Lock className="h-3 w-3" /> só por promoção</span> : <span className="text-text-muted">{ENVS[e].purpose}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-card border border-border p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Vault className="h-4 w-4 text-accent" strokeWidth={1.5} /> Credencial
        </div>
        {d.secretRef ? (
          <div className="flex flex-wrap items-center gap-3">
            <IconCircle icon={Lock} tone="green" size="sm" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-sm"><Chip tone="green" icon={Check}>No cofre</Chip> <span className="text-text-muted">o segredo fica no cofre</span></div>
              <Mono className="mt-1 block break-all text-primary">{d.secretRef}</Mono>
            </div>
            <Button size="sm" variant="ghost" onClick={() => set({ secretRef: null })}>Trocar credencial</Button>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {idLabel && (
              <Field label={idLabel}>
                <Input value={d.identity} onChange={(e) => set({ identity: e.target.value })} autoComplete="off" />
              </Field>
            )}
            <Field label={secretLabel} hint="Nunca é exibido nem salvo no Córtex.">
              <Input type="password" value={d.secretDraft} onChange={(e) => set({ secretDraft: e.target.value })} autoComplete="new-password" />
            </Field>
            <div className="flex items-end md:col-span-2">
              <Button icon={Vault} loading={d.vault === 'enviando'} disabled={!d.secretDraft} onClick={() => void sendToVault()}>
                Enviar ao cofre
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StepMap({ api }: { api: WizardApi }) {
  const ws = useWs();
  const { data: d, set } = api;
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Mapear e sincronizar</h3>
        <p className="text-sm text-text-muted">Domínio de dados de destino, modo de sincronização e quais ações viram tools para agentes.</p>
      </div>
      <Field label="Domínio de destino">
        <Select value={d.domainId} onChange={(e) => set({ domainId: e.target.value })} options={ws.domains.map((x) => ({ value: x.id, label: `${x.name} (${x.kind === 'negocio' ? 'negócio' : 'técnico'})` }))} />
      </Field>
      <div>
        <span className="mb-1 block text-xs font-medium text-text-muted">Modo de sincronização</span>
        <div className="grid gap-2 sm:grid-cols-3">
          {(Object.keys(SYNC_LABEL) as SyncMode[]).map((m) => (
            <button
              key={m}
              onClick={() => set({ syncMode: m })}
              className={cx('rounded-card border px-3 py-2 text-left text-sm transition-colors', d.syncMode === m ? 'border-primary bg-primary/10' : 'border-border hover:bg-surface-2')}
            >
              <div className="font-medium">{SYNC_LABEL[m]}</div>
              <div className="text-[11px] text-text-muted">
                {m === 'cdc' ? 'Mudanças chegam em segundos' : m === 'agendado' ? 'Janela a cada hora' : 'Lê só quando a jornada pede'}
              </div>
            </button>
          ))}
        </div>
      </div>
      <div>
        <span className="mb-1 flex items-center gap-1 text-xs font-medium text-text-muted"><Wrench className="h-3.5 w-3.5" /> Ações que viram tools para agentes</span>
        <ul className="space-y-1.5">
          {d.tools.map((t) => (
            <li key={t.id}>
              <label className="flex cursor-pointer items-center gap-3 rounded-field border border-border px-3 py-2 hover:bg-surface-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[#00FF95]"
                  checked={!!d.toolSel[t.id]}
                  onChange={(e) => set({ toolSel: { ...d.toolSel, [t.id]: e.target.checked } })}
                />
                <span className="min-w-0 flex-1">
                  <Mono className="block">{t.name}</Mono>
                  <span className="block text-xs text-text-muted">{t.description}</span>
                </span>
                <ModeChip mode={t.mode} />
                {t.mode === 'escrita' && <Chip tone="muted" icon={Lock}>Desligada em Prd</Chip>}
              </label>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-text-muted">Toda tool de escrita nasce desligada para agentes em Prd e exige política explícita.</p>
      </div>
    </div>
  );
}
