'use client';

import type { ReactNode } from 'react';
import { ArrowRight, CalendarCheck, Compass, FlaskConical, Rocket, Sprout, Target, Users, type LucideIcon } from 'lucide-react';
import { ENV_ORDER } from '@cortex/schemas';
import { DEMO_IDS } from '@cortex/seed';
import { formatBRL, formatNumber } from '@cortex/engine';
import { useCortex, useEnv, useWs } from '@/lib/store';
import { Button, Card, Chip, EnvBadge, IconCircle, Mono, PageHeader, Progress, Table, cx } from '@/components/ui';

const MOCK_TO_REAL: { cap: string; mock: string; real: string }[] = [
  { cap: 'Conectores', mock: 'Mocks por sistema; PostgreSQL e REST/OpenAPI reais', real: 'Conectores reais priorizados pelo primeiro cliente' },
  { cap: 'Dados', mock: 'Seeds em JSON e IndexedDB', real: 'PostgreSQL e o lakehouse do cliente' },
  { cap: 'Conhecimento', mock: 'Recuperações pré-calculadas', real: 'Ingestão e busca vetorial com pgvector' },
  { cap: 'Jornadas', mock: 'Execução roteirizada; código real gerado pelo Claude Code', real: 'Execução real com filas e reprocessamento' },
  { cap: 'MCP', mock: 'Real, sobre dados mockados', real: 'Real, sobre o cérebro do cliente' },
  { cap: 'Acesso', mock: 'Perfis simulados', real: 'Entra ID com perfis e escopos' },
  { cap: 'Telemetria', mock: 'Séries sintéticas de 90 dias, eventos da sessão e OpenTelemetry do Claude Code', real: 'Coleta OpenTelemetry e armazenamento analítico' },
];

function fmt(n: number, unit: string) {
  return unit === '%' ? `${formatNumber(n, 1)}%` : `${formatNumber(n, 1)} ${unit}`;
}

function StageCard({ n, tour, icon, tone, title, lead, children }: {
  n: number; tour: string; icon: LucideIcon; tone: 'green' | 'purple'; title: string; lead: string; children: ReactNode;
}) {
  return (
    <Card data-tour={tour} halo={tone} className="flex flex-col p-5">
      <div className="flex items-center gap-3">
        <IconCircle icon={icon} tone={tone} size="lg" />
        <div>
          <div className="font-mono text-xs text-text-muted">Etapa {n}</div>
          <h2 className="text-xl font-semibold">{title}</h2>
        </div>
      </div>
      <p className="mt-3 text-sm text-text-muted">{lead}</p>
      <div className="mt-4 flex-1 space-y-4">{children}</div>
    </Card>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-medium text-text-muted">{title}</div>
      {children}
    </div>
  );
}

export function EncerramentoScreen() {
  const ws = useWs();
  const env = useEnv();
  const toast = useCortex((s) => s.toast);
  const ids = DEMO_IDS[ws.workspace.industry];

  // Semear
  const connected = ws.connectors.filter((c) => c.status === 'conectado' || c.status === 'sincronizando' || c.status === 'degradado');
  const islands = ws.systems.filter((s) => s.category !== 'canal' && !(s.connectorId && ws.connectors.some((c) => c.id === s.connectorId)));
  const areas = [...ws.brainAreas].sort((a, b) => b.coverage - a.coverage).slice(0, 4);
  const contracts = ws.contracts.filter((c) => c.status === 'publicado').length;

  // Provar
  const anchor = ws.journeys.find((j) => j.id === ids.anchorJourneyId);
  const anchorIni = ws.initiatives.find((i) => i.id === ids.anchorInitiativeId);
  const kpis = anchor ? anchor.kpis.map((name) => ({ name, k: ws.cockpit.valueKpis.find((v) => v.name === name) })) : [];

  // Escalar
  const others = ws.initiatives.filter((i) => i.id !== ids.anchorInitiativeId);
  const othersValue = others.reduce((a, i) => a + i.expectedValueBRL, 0);
  const nextOnes = others.filter((i) => i.stage === 'ideia' || i.stage === 'validacao').sort((a, b) => b.expectedValueBRL - a.expectedValueBRL).slice(0, 3);
  const otherJourneys = ws.journeys.filter((j) => j.id !== ids.anchorJourneyId);
  const reusable = ws.components.filter((c) => c.status === 'homologado' || c.status === 'publicado_prd').length;
  const domainsTouched = new Set(ws.initiatives.map((i) => i.domainId)).size;

  const next = (title: string, description: string) => toast({ kind: 'info', title, description });

  return (
    <div className="showcase-bg min-h-full">
      <PageHeader
        title="Como começamos"
        subtitle={`Semear, Provar, Escalar aplicados à ${ws.workspace.company}: começar pequeno, provar valor com uma jornada que importa e escalar sobre o mesmo cérebro.`}
        actions={<Chip tone="yellow" icon={FlaskConical}>Dados de demonstração</Chip>}
      />

      <div className="relative mb-6 grid gap-4 lg:grid-cols-3">
        <StageCard n={1} tour="encerramento-semear" icon={Sprout} tone="green" title="Semear" lead="Conectar os primeiros sistemas e montar o cérebro inicial com o que a empresa já tem.">
          <Block title={`Sistemas conectados (${connected.length})`}>
            <div className="flex flex-wrap gap-1.5">
              {connected.slice(0, 5).map((c) => (
                <Chip key={c.id} tone="green">{c.name}</Chip>
              ))}
              {connected.length > 5 && <Chip tone="muted">+{connected.length - 5}</Chip>}
            </div>
            {islands.length > 0 && <p className="mt-1.5 text-xs text-text-muted">Ainda ilhas: {islands.map((s) => s.name).join(', ')}.</p>}
          </Block>
          <Block title="Áreas do cérebro com mais conteúdo homologado">
            <ul className="space-y-2">
              {areas.map((a) => (
                <li key={a.id}>
                  <div className="flex justify-between text-sm">
                    <span className="truncate">{a.name}</span>
                    <span className="text-text-muted">{a.coverage}%</span>
                  </div>
                  <Progress value={a.coverage} tone={a.side === 'negocio' ? 'purple' : 'green'} />
                </li>
              ))}
            </ul>
          </Block>
          <p className="text-sm"><span className="font-semibold">{contracts}</span> <span className="text-text-muted">contratos de dados publicados como base.</span></p>
        </StageCard>

        <StageCard n={2} tour="encerramento-provar" icon={Target} tone="purple" title="Provar" lead="Uma jornada de valor em produção, medida contra a linha de base acordada com o negócio.">
          {anchor ? (
            <>
              <Block title="Jornada para provar">
                <div className="rounded-field border border-border bg-surface-2 p-3">
                  <div className="text-sm font-medium">{anchor.name}</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {ENV_ORDER.map((e) => (
                      <span key={e} className={cx('inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs', e === env ? 'border-accent/60' : 'border-border')}>
                        <EnvBadge env={e} />
                        {anchor.envVersions[e] ? <Mono>v{anchor.envVersions[e]}</Mono> : <span className="text-text-muted">—</span>}
                      </span>
                    ))}
                  </div>
                </div>
              </Block>
              <Block title="KPIs que provam o valor">
                <ul className="space-y-1.5">
                  {kpis.map(({ name, k }) => (
                    <li key={name} className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate">{name}</span>
                      {k ? (
                        <span className="shrink-0 text-xs text-text-muted">
                          {fmt(k.baseline, k.unit)} <ArrowRight className="inline h-3 w-3" /> <span className="font-semibold text-primary">{fmt(k.target, k.unit)}</span>
                        </span>
                      ) : (
                        <span className="shrink-0 text-xs text-text-muted">linha de base a acordar</span>
                      )}
                    </li>
                  ))}
                </ul>
              </Block>
              {anchorIni && (
                <Block title="Valor esperado">
                  <div className="text-[32px] font-semibold leading-none text-primary">{formatBRL(anchorIni.expectedValueBRL).replace(',00', '')}</div>
                  <div className="mt-1 text-xs text-text-muted">por ano · {anchorIni.metric}</div>
                </Block>
              )}
            </>
          ) : (
            <p className="text-sm text-text-muted">Escolhemos juntos a jornada de maior valor e menor risco para provar.</p>
          )}
        </StageCard>

        <StageCard n={3} tour="encerramento-escalar" icon={Rocket} tone="green" title="Escalar" lead="Com o cérebro formado, novas iniciativas reaproveitam o que já existe, domínio a domínio.">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-field border border-border bg-surface-2 p-2 text-center">
              <div className="text-xl font-semibold text-primary">{others.length}</div>
              <div className="text-[11px] text-text-muted">iniciativas no portfólio</div>
            </div>
            <div className="rounded-field border border-border bg-surface-2 p-2 text-center">
              <div className="text-xl font-semibold text-primary">{domainsTouched}</div>
              <div className="text-[11px] text-text-muted">domínios envolvidos</div>
            </div>
            <div className="rounded-field border border-border bg-surface-2 p-2 text-center">
              <div className="text-xl font-semibold text-primary">{reusable}</div>
              <div className="text-[11px] text-text-muted">componentes reutilizáveis</div>
            </div>
          </div>
          <Block title="Próximas candidatas">
            <ul className="space-y-1.5">
              {nextOnes.map((i) => (
                <li key={i.id} className="flex items-start justify-between gap-2 text-sm">
                  <span className="min-w-0">{i.title}</span>
                  <span className="shrink-0 text-xs text-text-muted">{formatBRL(i.expectedValueBRL).replace(',00', '')}</span>
                </li>
              ))}
            </ul>
          </Block>
          <Block title="Jornadas que já usam o mesmo cérebro">
            <div className="flex flex-wrap gap-1.5">
              {otherJourneys.map((j) => (
                <Chip key={j.id} tone="purple">{j.name}</Chip>
              ))}
            </div>
          </Block>
          <p className="text-sm text-text-muted">
            <span className="font-semibold text-text">{formatBRL(othersValue).replace(',00', '')}</span> de valor esperado além da primeira jornada.
          </p>
        </StageCard>
      </div>

      <section data-tour="encerramento-plano" className="grid gap-4 rounded-card lg:grid-cols-5">
        <Card halo="purple" className="flex flex-col p-5 lg:col-span-2">
          <div className="flex items-center gap-2">
            <Compass className="h-5 w-5 text-accent" strokeWidth={1.5} />
            <h2 className="text-lg font-semibold">O próximo passo é de vocês</h2>
          </div>
          <p className="mt-2 text-sm text-text-muted">
            O que vimos hoje roda sobre dados fictícios da {ws.workspace.company}, mas o caminho é o mesmo de um projeto real. Sugerimos começar pela jornada que mais importa para o negócio; a escolha, o ritmo e o escopo são decisões de vocês.
          </p>
          <div className="mt-4 flex flex-col gap-2">
            <Button variant="primary" icon={Target} onClick={() => next('Anotado', 'Vamos levar a escolha da primeira jornada para a conversa com o time de vocês.')}>
              Escolher a jornada para provar
            </Button>
            <Button variant="secondary" icon={CalendarCheck} onClick={() => next('Anotado', 'A oficina de Semear será combinada com o time de vocês.')}>
              Combinar a oficina de Semear
            </Button>
            <Button variant="tertiary" icon={Users} onClick={() => next('Anotado', 'Podemos repetir a demo com o time técnico, com foco em IDEs & MCP e construção.')}>
              Rever a demo com o time técnico
            </Button>
          </div>
        </Card>

        <Card className="lg:col-span-3">
          <div className="border-b border-border px-4 py-3">
            <div className="text-sm font-semibold">Do mock à versão inicial</div>
            <div className="text-xs text-text-muted">Nenhuma tela muda nessa passagem: o protótipo é a primeira versão da solução.</div>
          </div>
          <div className="p-3">
            <Table
              dense
              rows={MOCK_TO_REAL}
              rowKey={(r) => r.cap}
              columns={[
                { key: 'c', header: 'Capacidade', render: (r) => <span className="font-medium">{r.cap}</span> },
                { key: 'm', header: 'No protótipo', render: (r) => <span className="text-text-muted">{r.mock}</span> },
                { key: 'r', header: 'Na versão inicial real', render: (r) => r.real },
              ]}
            />
          </div>
        </Card>
      </section>
    </div>
  );
}
