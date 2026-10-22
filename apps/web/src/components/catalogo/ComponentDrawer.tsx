'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle, ArrowRight, BadgeCheck, CheckCircle2, CircleDot, Download, Loader2, Package, Rocket, Send, ShieldCheck, Terminal, Users, Workflow, XCircle, Archive,
} from 'lucide-react';
import { COMPONENT_TYPES, PROFILES, type Approval, type Component } from '@cortex/schemas';
import { useCortex, useEnv, useProfile, useWs, demoNow } from '@/lib/store';
import { sleep } from '@/lib/tour-bus';
import {
  Button, Chip, CodeBlock, DiffView, Drawer, EmptyState, EnvBadge, KpiNumber, Modal, Mono, NoPermission, Progress, Select, StatusChip, Tabs, cx, useCan,
} from '@/components/ui';
import { LIFECYCLE, TYPE_ICON, availableEnvs, consumersOf, previousVersion, substituteFrom } from './lib';

type TabId = 'geral' | 'conteudo' | 'versoes' | 'consumo' | 'avaliacao';

const CHECKS = (c: Component) => [
  { label: 'Segurança: sem segredos nem dado pessoal aberto', ms: 180 + (c.name.length % 7) * 23 },
  { label: 'Formato: entradas, saídas e metadados completos', ms: 95 + (c.version.length % 5) * 17 },
  { label: `Avaliação: ${c.evaluation.passed} de ${c.evaluation.cases} casos de teste`, ms: 640 + c.evaluation.cases * 9 },
  { label: 'Dependências homologadas no catálogo', ms: 120 + c.dependencies.length * 31 },
];

export function ComponentDrawer({ component, onClose, onOpen }: { component: Component | null; onClose: () => void; onOpen: (id: string) => void }) {
  const [tab, setTab] = useState<TabId>('geral');
  useEffect(() => setTab('geral'), [component?.id]);
  if (!component) return null;
  const Icon = TYPE_ICON[component.type];
  return (
    <Drawer
      open
      onClose={onClose}
      width={640}
      title={
        <span className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-accent" strokeWidth={1.5} />
          {component.name}
          <Mono className="text-accent-soft">v{component.version}</Mono>
        </span>
      }
      subtitle={`${COMPONENT_TYPES[component.type].label}${component.packageKind ? ` · ${component.packageKind === 'jornada' ? 'Jornada (curta)' : 'Esteira (durável)'}` : ''} · ${component.owner}`}
      footer={<LifecycleActions c={component} />}
    >
      <Lifecycle c={component} />
      <Tabs<TabId>
        className="mb-4 mt-4"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'geral', label: 'Visão geral' },
          { id: 'conteudo', label: 'Conteúdo' },
          { id: 'versoes', label: 'Versões' },
          { id: 'consumo', label: 'Quem consome' },
          { id: 'avaliacao', label: 'Avaliação e aprovações' },
        ]}
      />
      {tab === 'geral' && <Overview c={component} onOpen={onOpen} />}
      {tab === 'conteudo' && <Content c={component} />}
      {tab === 'versoes' && <Versions c={component} />}
      {tab === 'consumo' && <Consumers c={component} onOpen={onOpen} />}
      {tab === 'avaliacao' && <Evaluation c={component} />}
    </Drawer>
  );
}

function Lifecycle({ c }: { c: Component }) {
  const idx = LIFECYCLE.findIndex((s) => s.id === c.status);
  const sub = substituteFrom(c);
  return (
    <div>
      <ol className="flex items-center gap-1" aria-label="Ciclo de homologação">
        {LIFECYCLE.map((s, i) => {
          const done = i < idx;
          const current = i === idx;
          return (
            <li key={s.id} className="flex flex-1 items-center gap-1">
              <div
                className={cx(
                  'flex min-w-0 flex-1 flex-col items-center rounded-field border px-1 py-2 text-center',
                  current && s.id !== 'depreciado' && 'border-primary/60 bg-primary/10 shadow-halo-green',
                  current && s.id === 'depreciado' && 'border-warning/50 bg-warning/5',
                  done && 'border-border bg-surface-2',
                  !done && !current && 'border-dashed border-border opacity-50',
                )}
              >
                {done ? <CheckCircle2 className="h-4 w-4 text-primary" /> : current ? <CircleDot className={cx('h-4 w-4', s.id === 'depreciado' ? 'text-warning' : 'text-primary')} /> : <CircleDot className="h-4 w-4 text-text-muted" />}
                <span className="mt-1 text-[11px] font-medium leading-tight">{s.label}</span>
              </div>
              {i < LIFECYCLE.length - 1 && <ArrowRight className="h-3 w-3 shrink-0 text-text-muted" />}
            </li>
          );
        })}
      </ol>
      {c.status === 'depreciado' && (
        <div className="mt-3 flex items-start gap-2 rounded-field border border-warning/40 bg-warning/5 px-3 py-2 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <span>Continua funcionando para quem já usa, com aviso. {sub ? <>Substituto sugerido: <b className="font-medium">{sub}</b>.</> : c.content}</span>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-5">
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-text-muted">{title}</h3>
      {children}
    </section>
  );
}

function Overview({ c, onOpen }: { c: Component; onOpen: (id: string) => void }) {
  const ws = useWs();
  const env = useEnv();
  const [install, setInstall] = useState(false);
  const domain = c.domainId ? ws.domains.find((d) => d.id === c.domainId)?.name : undefined;
  const deps = c.dependencies.map((id) => ws.components.find((x) => x.id === id) ?? null);
  const cons = useMemo(() => consumersOf(ws, c), [ws, c]);
  const coe = [...c.approvals].reverse().find((a) => a.profile === 'coe');
  const envs = availableEnvs(c.status);
  return (
    <div>
      <p className="mb-4 text-sm">{c.description}</p>
      <div className="mb-5 grid grid-cols-3 gap-3 rounded-card border border-border bg-surface-2 p-3">
        <div>
          <div className="text-xs text-text-muted">Versão</div>
          <Mono className="text-sm text-accent-soft">v{c.version}</Mono>
        </div>
        <div>
          <div className="text-xs text-text-muted">Consumidores</div>
          <div className="text-sm font-semibold">{c.consumers}</div>
        </div>
        <div>
          <div className="text-xs text-text-muted">Aprovação do CoE AI</div>
          {coe ? <StatusChip status={coe.decision} label={coe.decision === 'aprovado' ? `Aprovado · ${coe.by.split(' ')[0]}` : 'Ajuste pedido'} /> : <Chip tone="muted">Ainda não avaliado</Chip>}
        </div>
        <div>
          <div className="text-xs text-text-muted">Domínio</div>
          <div className="text-sm">{domain ?? 'Transversal'}</div>
        </div>
        <div className="col-span-2">
          <div className="text-xs text-text-muted">Disponível em</div>
          <div className="mt-0.5 flex gap-1">
            {envs.length ? envs.map((e) => <EnvBadge key={e} env={e} />) : <Chip tone="muted">Só no rascunho</Chip>}
            {!envs.includes(env) && <span className="text-xs text-warning">· não disponível no ambiente ativo</span>}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Section title="Entradas">
          {c.inputs.length ? <ul className="space-y-1">{c.inputs.map((i) => <li key={i} className="font-mono text-xs">{i}</li>)}</ul> : <span className="text-xs text-text-muted">Sem entradas declaradas.</span>}
        </Section>
        <Section title="Saídas">
          {c.outputs.length ? <ul className="space-y-1">{c.outputs.map((o) => <li key={o} className="font-mono text-xs">{o}</li>)}</ul> : <span className="text-xs text-text-muted">Sem saídas declaradas.</span>}
        </Section>
      </div>

      <Section title={c.type === 'pacote' ? 'Composição' : 'Dependências'}>
        {deps.length === 0 ? (
          <span className="text-xs text-text-muted">Não depende de outros componentes.</span>
        ) : (
          <ul className="space-y-1.5">
            {deps.map((d, i) =>
              d ? (
                <li key={d.id}>
                  <button onClick={() => onOpen(d.id)} className="flex w-full items-center justify-between gap-2 rounded-field border border-border bg-surface-2 px-3 py-2 text-left text-sm hover:border-accent">
                    <span className="flex min-w-0 items-center gap-2">
                      {(() => { const I = TYPE_ICON[d.type]; return <I className="h-4 w-4 shrink-0 text-accent" strokeWidth={1.5} />; })()}
                      <span className="truncate">{d.name}</span>
                      <Mono className="text-text-muted">{d.version}</Mono>
                    </span>
                    <StatusChip status={d.status} />
                  </button>
                </li>
              ) : (
                <li key={c.dependencies[i]} className="font-mono text-xs text-text-muted">{c.dependencies[i]}</li>
              ),
            )}
          </ul>
        )}
      </Section>

      {c.type === 'pacote' && (
        <div className="mb-5 flex items-center justify-between gap-3 rounded-card border border-primary/40 bg-primary/5 p-3">
          <div className="text-sm">
            <div className="font-medium">Leve o pacote para a IDE</div>
            <div className="text-xs text-text-muted">Instala os componentes fixados como plugin, executado no Claude Code.</div>
          </div>
          <Button variant="primary" size="sm" icon={Download} onClick={() => setInstall(true)}>Instalar no Claude Code</Button>
        </div>
      )}

      <Section title="Quem consome">
        <div className="flex flex-wrap gap-2 text-xs">
          <Chip tone="purple" icon={Workflow}>{cons.journeys.length} jornada(s)</Chip>
          <Chip tone="green" icon={Package}>{cons.packages.length} pacote(s)</Chip>
          <Chip tone="muted" icon={Users}>{cons.dependents.length} componente(s)</Chip>
        </div>
      </Section>
      <InstallModal c={c} open={install} onClose={() => setInstall(false)} />
    </div>
  );
}

function InstallModal({ c, open, onClose }: { c: Component; open: boolean; onClose: () => void }) {
  const ws = useWs();
  const plugin = c.outputs.find((o) => o.startsWith('plugin '))?.replace('plugin ', '') ?? `cortex-${c.id}@${c.version}`;
  const cmd = ['/plugin marketplace add cortex/cortex-marketplace', '/plugin install cortex@cortex-marketplace', `/cortex:pacote ${plugin}`].join('\n');
  return (
    <Modal open={open} onClose={onClose} title="Instalar no Claude Code" subtitle={`${c.name} · ${ws.workspace.company}`} footer={<Button variant="tertiary" onClick={onClose}>Fechar</Button>}>
      <p className="mb-3 text-sm text-text-muted">
        Cole no terminal do Claude Code. O plugin do Córtex conecta ao MCP do workspace e fixa as versões homologadas deste pacote; o comando é executado no Claude Code, dentro da licença de quem usa.
      </p>
      <CodeBlock code={cmd} />
      <div className="mt-3 flex items-center gap-2 text-xs text-text-muted">
        <Terminal className="h-3.5 w-3.5" /> Componentes fixados: {c.dependencies.length}. Atualizações chegam só depois de homologadas pelo CoE AI.
      </div>
    </Modal>
  );
}

function Content({ c }: { c: Component }) {
  return (
    <div>
      <Section title={c.type === 'rule' ? 'Definição da regra' : c.type === 'skill' || c.type === 'agent' ? 'Instruções' : 'Definição'}>
        <CodeBlock code={c.content} maxHeight={480} />
      </Section>
    </div>
  );
}

function Versions({ c }: { c: Component }) {
  const prev = previousVersion(c);
  return (
    <div>
      <Section title="Changelog">
        <ol className="space-y-2">
          {[...c.changelog].reverse().map((l, i) => (
            <li key={`${l.version}-${i}`} className="flex gap-3 rounded-field border border-border bg-surface-2 px-3 py-2">
              <Mono className="w-14 shrink-0 text-accent-soft">{l.version}</Mono>
              <span className="flex-1 text-sm">{l.note}</span>
              <span className="shrink-0 text-xs text-text-muted">{new Date(`${l.date}T12:00:00Z`).toLocaleDateString('pt-BR')}</span>
            </li>
          ))}
        </ol>
      </Section>
      <Section title="Diff entre versões">
        {prev ? (
          <DiffView before={prev.content} after={c.content} titleBefore={`v${prev.version}`} titleAfter={`v${c.version}`} />
        ) : (
          <EmptyState title="Primeira versão" description="Quando houver uma nova versão, as diferenças aparecem lado a lado aqui." />
        )}
      </Section>
    </div>
  );
}

function Consumers({ c, onOpen }: { c: Component; onOpen: (id: string) => void }) {
  const ws = useWs();
  const cons = useMemo(() => consumersOf(ws, c), [ws, c]);
  if (!cons.journeys.length && !cons.packages.length && !cons.dependents.length) {
    return <EmptyState title="Ninguém consome ainda" description="Quando uma jornada, pacote ou agente usar este componente, ele aparece aqui com a versão por ambiente." icon={Users} />;
  }
  return (
    <div>
      {cons.journeys.length > 0 && (
        <Section title="Jornadas">
          <ul className="space-y-1.5">
            {cons.journeys.map(({ journey, envs }) => (
              <li key={journey.id}>
                <Link href={`/jornadas/studio?id=${encodeURIComponent(journey.id)}`} className="flex items-center justify-between gap-2 rounded-field border border-border bg-surface-2 px-3 py-2 text-sm hover:border-accent">
                  <span className="flex min-w-0 items-center gap-2"><Workflow className="h-4 w-4 shrink-0 text-accent" strokeWidth={1.5} /><span className="truncate">{journey.name}</span></span>
                  <span className="flex shrink-0 gap-1">{envs.length ? envs.map((e) => <EnvBadge key={e} env={e} />) : <Chip tone="muted">Em rascunho</Chip>}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}
      {[...cons.packages, ...cons.dependents].length > 0 && (
        <Section title="Pacotes e componentes">
          <ul className="space-y-1.5">
            {[...cons.packages, ...cons.dependents].map((d) => (
              <li key={d.id}>
                <button onClick={() => onOpen(d.id)} className="flex w-full items-center justify-between gap-2 rounded-field border border-border bg-surface-2 px-3 py-2 text-left text-sm hover:border-accent">
                  <span className="truncate">{d.name} <Mono className="text-text-muted">{d.version}</Mono></span>
                  <StatusChip status={d.status} />
                </button>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

function Evaluation({ c }: { c: Component }) {
  const ws = useWs();
  const requests = ws.approvals.filter((a) => a.objectId === c.id);
  const tone = c.evaluation.score >= 90 ? 'green' : c.evaluation.score >= 80 ? 'purple' : 'yellow';
  return (
    <div>
      <Section title="Resultados de avaliação">
        <div className="grid grid-cols-3 gap-3 rounded-card border border-border bg-surface-2 p-4">
          <KpiNumber value={`${c.evaluation.score.toFixed(1).replace('.', ',')}%`} label="nota da suíte" tone={tone === 'green' ? 'green' : 'text'} />
          <KpiNumber value={c.evaluation.passed} label="casos aprovados" tone="text" />
          <KpiNumber value={c.evaluation.cases} label="casos na suíte" tone="text" />
          <div className="col-span-3"><Progress value={c.evaluation.score} tone={tone} /></div>
        </div>
      </Section>
      <Section title="Histórico de aprovação">
        {c.approvals.length === 0 && requests.length === 0 ? (
          <EmptyState title="Sem aprovações ainda" description="Ao enviar para revisão, o pedido entra na fila do CoE AI e o histórico aparece aqui." icon={ShieldCheck} />
        ) : (
          <ol className="space-y-2">
            {[...c.approvals].reverse().map((a, i) => (
              <li key={`${a.at}-${i}`} className="rounded-field border border-border bg-surface-2 px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium">{a.by} <span className="font-normal text-text-muted">· {PROFILES[a.profile].label}</span></span>
                  <StatusChip status={a.decision} />
                </div>
                {a.note && <p className="mt-1 text-xs text-text-muted">{a.note}</p>}
                <div className="mt-1 text-[11px] text-text-muted">{new Date(a.at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</div>
              </li>
            ))}
            {requests.filter((r) => r.status === 'pendente').map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 rounded-field border border-dashed border-warning/50 px-3 py-2 text-sm">
                <span>{r.title}</span>
                <StatusChip status="pendente" />
              </li>
            ))}
          </ol>
        )}
      </Section>
    </div>
  );
}

// ---------- Ações do ciclo ----------
function LifecycleActions({ c }: { c: Component }) {
  const ws = useWs();
  const profile = useProfile();
  const mutate = useCortex((s) => s.mutate);
  const replaceWorkspace = useCortex((s) => s.replaceWorkspace);
  const toast = useCortex((s) => s.toast);
  const canHomologate = useCan('homologar_componente');
  const canPrd = useCan('aprovar_prd');
  const [checks, setChecks] = useState<number | null>(null);
  const [depOpen, setDepOpen] = useState(false);
  const me = ws.users.find((u) => u.profile === profile)?.name ?? 'Usuário da demo';
  const list = CHECKS(c);

  const patch = (fn: (x: Component, d: typeof ws) => void, action: string, title: string, description?: string) => {
    const before = mutate(
      (d) => {
        const x = d.components.find((k) => k.id === c.id);
        if (x) fn(x, d);
      },
      { action, object: `${c.name} ${c.version}` },
    );
    toast({ kind: 'sucesso', title, description, undo: before ? () => replaceWorkspace(before) : undefined });
  };

  const sendToReview = async () => {
    for (let i = 0; i <= list.length; i++) {
      setChecks(i);
      await sleep(i < list.length ? 450 : 300);
    }
    patch(
      (x, d) => {
        x.status = 'em_revisao';
        x.changelog = [...x.changelog, { version: x.version, date: demoNow().slice(0, 10), note: 'Enviado para revisão: checagens automáticas aprovadas.' }];
        const ap: Approval = { id: `${x.id}-rev-${Date.now()}`, kind: 'componente', title: `Homologar "${x.name}" ${x.version}`, requestedBy: me, requestedAt: demoNow(), status: 'pendente', approverProfile: 'coe', objectId: x.id, comments: [] };
        d.approvals = [ap, ...d.approvals];
      },
      'Enviou componente para revisão',
      'Enviado para revisão',
      'Checagens automáticas ok. O pedido entrou na fila do CoE AI.',
    );
    setChecks(null);
  };

  const homologate = () =>
    patch(
      (x, d) => {
        x.status = 'homologado';
        x.approvals = [...x.approvals, { at: demoNow(), by: me, profile, decision: 'aprovado', note: 'Checagens e avaliação dentro do mínimo; liberado para Dev e Hml.' }];
        d.approvals.forEach((a) => { if (a.objectId === x.id && a.status === 'pendente') a.status = 'aprovado'; });
      },
      'Homologou componente',
      'Componente homologado',
      'Liberado para Dev e Hml.',
    );

  const publishPrd = () =>
    patch(
      (x) => {
        x.status = 'publicado_prd';
        x.approvals = [...x.approvals, { at: demoNow(), by: me, profile, decision: 'aprovado', note: 'Liberado para jornadas em produção.' }];
        x.changelog = [...x.changelog, { version: x.version, date: demoNow().slice(0, 10), note: 'Publicado em Prd.' }];
      },
      'Publicou componente em Prd',
      'Publicado em Prd',
      'Disponível para jornadas em produção.',
    );

  const status = c.status;
  return (
    <div className="space-y-3">
      {checks !== null && (
        <div className="space-y-1.5 rounded-field border border-border bg-surface-2 p-3">
          {list.map((k, i) => (
            <div key={k.label} className={cx('flex items-center gap-2 text-sm', i > checks && 'opacity-40')}>
              {i < checks ? <CheckCircle2 className="h-4 w-4 text-primary" /> : i === checks ? <Loader2 className="h-4 w-4 animate-spin text-primary-soft" /> : <CircleDot className="h-4 w-4 text-text-muted" />}
              <span className="flex-1">{k.label}</span>
              {i < checks && <Mono className="text-text-muted">{k.ms} ms</Mono>}
            </div>
          ))}
        </div>
      )}
      {status === 'em_revisao' && !canHomologate && <NoPermission action="homologar_componente" />}
      {status === 'homologado' && !canPrd && <NoPermission action="aprovar_prd" />}
      <div className="flex flex-wrap justify-end gap-2">
        {(status === 'homologado' || status === 'publicado_prd') && canHomologate && (
          <Button variant="ghost" icon={Archive} onClick={() => setDepOpen(true)}>Depreciar</Button>
        )}
        {status === 'rascunho' && (
          <Button variant="primary" icon={Send} loading={checks !== null} onClick={() => void sendToReview()}>Enviar para revisão</Button>
        )}
        {status === 'em_revisao' && (
          <Button variant="primary" icon={BadgeCheck} disabled={!canHomologate} onClick={homologate}>Homologar</Button>
        )}
        {status === 'homologado' && (
          <Button variant="primary" icon={Rocket} disabled={!canPrd} onClick={publishPrd}>Publicar em Prd</Button>
        )}
        {status === 'publicado_prd' && <Chip tone="green" icon={CheckCircle2}>Em produção</Chip>}
        {status === 'depreciado' && <Chip tone="muted" icon={XCircle}>Ciclo encerrado</Chip>}
      </div>
      <DeprecateModal c={c} open={depOpen} onClose={() => setDepOpen(false)} onConfirm={(subName) => {
        setDepOpen(false);
        patch(
          (x) => {
            x.status = 'depreciado';
            x.changelog = [...x.changelog, { version: x.version, date: demoNow().slice(0, 10), note: subName ? `Depreciado. Substituto sugerido: ${subName}` : 'Depreciado.' }];
          },
          'Depreciou componente',
          'Componente depreciado',
          'Quem usa continua funcionando, com aviso e sugestão de substituto.',
        );
      }} />
    </div>
  );
}

function DeprecateModal({ c, open, onClose, onConfirm }: { c: Component; open: boolean; onClose: () => void; onConfirm: (substitute: string | null) => void }) {
  const ws = useWs();
  const cons = useMemo(() => consumersOf(ws, c), [ws, c]);
  const candidates = ws.components.filter((x) => x.id !== c.id && x.type === c.type && x.status !== 'depreciado' && x.status !== 'rascunho');
  const [sub, setSub] = useState('');
  useEffect(() => setSub(candidates[0]?.id ?? ''), [c.id, open]); // eslint-disable-line react-hooks/exhaustive-deps
  const subComp = candidates.find((x) => x.id === sub);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Depreciar "${c.name}"?`}
      subtitle="O componente continua funcionando para quem usa, com aviso"
      footer={
        <>
          <Button variant="tertiary" onClick={onClose}>Cancelar</Button>
          <Button variant="danger" icon={Archive} onClick={() => onConfirm(subComp ? `${subComp.name} ${subComp.version}` : null)}>Depreciar</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-field border border-warning/40 bg-warning/5 p-3 text-sm">
          <div className="mb-1 flex items-center gap-2 font-medium"><AlertTriangle className="h-4 w-4 text-warning" /> Impacto</div>
          <ul className="list-inside list-disc text-text-muted">
            <li>{c.consumers} consumidor(es) passam a ver o aviso de depreciação.</li>
            <li>{cons.journeys.length} jornada(s) usam este componente{cons.journeys.length ? `: ${cons.journeys.map((j) => j.journey.name).join(', ')}` : ''}.</li>
            <li>{cons.packages.length} pacote(s) o fixam na composição.</li>
          </ul>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-text-muted">Substituto sugerido</span>
          {candidates.length ? (
            <Select value={sub} onChange={(e) => setSub(e.target.value)} options={[...candidates.map((x) => ({ value: x.id, label: `${x.name} · ${x.version}` })), { value: '', label: 'Sem substituto' }]} />
          ) : (
            <span className="text-sm text-text-muted">Não há outro componente homologado do mesmo tipo.</span>
          )}
        </label>
      </div>
    </Modal>
  );
}
