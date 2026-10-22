'use client';

// Detalhe do conector (gaveta) e diálogos de ação: testar, duplicar, editar mapeamento, revogar e remover.
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  RefreshCw, Pencil, Trash2, Lock, Info, AlertTriangle, XCircle, CheckCircle2, KeyRound, ShieldOff, Copy, Activity, Gauge, Database,
} from 'lucide-react';
import { ENVS, ENV_ORDER, type Connector, type ConnectorTool, type EnvId, type LineageNode, type SyncMode } from '@cortex/schemas';
import { CONNECTOR_TYPES } from '@cortex/seed';
import { formatNumber, relativeTime } from '@cortex/engine';
import {
  Button, Card, Chip, Drawer, EmptyState, EnvBadge, Field, KpiNumber, Modal, Mono, Select, StatusChip, Tabs, cx, type ChipTone,
} from '@/components/ui';
import { Graph, type GraphNode, type GraphTone } from '@/components/ui/Graph';
import { demoNow, useCortex, useWs } from '@/lib/store';
import { sleep } from '@/lib/tour-bus';
import { AUTH_LABEL, SYNC_LABEL, computeImpact, impactCount, latencySeries, planChecks, secretRefFor, type CheckResult } from './helpers';
import { ChecksList, ModeChip, ObjectsView } from './parts';

type DetailTab = 'saude' | 'objetos' | 'tools' | 'credenciais' | 'linhagem' | 'logs';

export interface DetailCallbacks {
  onTest: (c: Connector) => void;
  onDuplicate: (c: Connector) => void;
  onEdit: (c: Connector) => void;
  onRemove: (c: Connector) => void;
}

export function DetalheConector({ id, onClose, canEdit, cb }: { id: string | null; onClose: () => void; canEdit: boolean; cb: DetailCallbacks }) {
  const ws = useWs();
  const c = ws.connectors.find((x) => x.id === id) ?? null;
  const [tab, setTab] = useState<DetailTab>('saude');
  const mutate = useCortex((s) => s.mutate);
  const toast = useCortex((s) => s.toast);
  const [resyncing, setResyncing] = useState(false);

  useEffect(() => setTab('saude'), [id]);

  if (!c) return null;
  const type = CONNECTOR_TYPES.find((t) => t.id === c.typeId);

  const resync = async () => {
    setResyncing(true);
    mutate((d) => {
      const x = d.connectors.find((k) => k.id === c.id);
      if (x) x.status = 'sincronizando';
    });
    await sleep(1400);
    mutate(
      (d) => {
        const x = d.connectors.find((k) => k.id === c.id);
        if (!x) return;
        x.status = 'conectado';
        x.lastSync = demoNow();
        x.logs = [...x.logs, { at: demoNow(), level: 'info', message: 'Ressincronização manual concluída sem erros.' }];
      },
      { action: 'Ressincronizou conector', object: c.name },
    );
    setResyncing(false);
    toast({ kind: 'sucesso', title: 'Ressincronização concluída', description: c.name });
  };

  return (
    <Drawer
      open
      onClose={onClose}
      width={860}
      title={<span className="flex items-center gap-2">{c.name} <StatusChip status={c.status} /></span>}
      subtitle={<span>{type?.name ?? c.typeId} · {AUTH_LABEL[type?.auth ?? 'api_key']} · <Mono>{c.id}</Mono></span>}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" icon={RefreshCw} loading={resyncing} disabled={!canEdit || c.status === 'rascunho' || c.status === 'pausado'} onClick={() => void resync()}>Ressincronizar</Button>
            <Button size="sm" variant="tertiary" icon={Pencil} disabled={!canEdit} onClick={() => cb.onEdit(c)}>Editar mapeamento</Button>
            <Button size="sm" variant="tertiary" icon={Activity} disabled={c.status === 'rascunho'} onClick={() => cb.onTest(c)}>Testar</Button>
            <Button size="sm" variant="tertiary" icon={Copy} disabled={!canEdit} onClick={() => cb.onDuplicate(c)}>Duplicar para outro ambiente</Button>
          </div>
          <Button size="sm" variant="danger" icon={Trash2} disabled={!canEdit} onClick={() => cb.onRemove(c)}>Revogar e remover</Button>
        </div>
      }
    >
      <Tabs<DetailTab>
        value={tab}
        onChange={setTab}
        className="mb-4"
        tabs={[
          { id: 'saude', label: 'Saúde' },
          { id: 'objetos', label: `Objetos (${c.objects.length})` },
          { id: 'tools', label: `Tools (${c.tools.length})` },
          { id: 'credenciais', label: 'Credenciais' },
          { id: 'linhagem', label: 'Linhagem' },
          { id: 'logs', label: 'Logs' },
        ]}
      />
      {tab === 'saude' && <Saude c={c} />}
      {tab === 'objetos' && (c.objects.length ? <ObjectsView objects={c.objects} /> : <EmptyState icon={Database} title="Nenhum objeto descoberto" description="Rode a descoberta pelo wizard ou ressincronize o conector." />)}
      {tab === 'tools' && <ToolsTab c={c} canEdit={canEdit} />}
      {tab === 'credenciais' && <Credenciais c={c} canEdit={canEdit} onDuplicate={() => cb.onDuplicate(c)} />}
      {tab === 'linhagem' && <Linhagem c={c} />}
      {tab === 'logs' && <Logs c={c} />}
    </Drawer>
  );
}

function Saude({ c }: { c: Connector }) {
  const series = useMemo(() => latencySeries(c), [c]);
  const max = Math.max(...series, 800);
  const p95 = [...series].sort((a, b) => a - b)[Math.floor(series.length * 0.95) - 1] ?? c.latencyMs;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <Card className="p-4"><KpiNumber value={c.latencyMs ? formatNumber(c.latencyMs) : '—'} label="Latência média (ms)" tone={c.latencyMs > 800 ? 'text' : 'green'} /></Card>
        <Card className="p-4"><KpiNumber value={formatNumber(c.volume)} label="Registros sincronizados" tone="purple" /></Card>
        <Card className="p-4"><KpiNumber value={relativeTime(c.lastSync, demoNow()) || '—'} label="Última sincronização" tone="text" /></Card>
        <Card className="p-4"><KpiNumber value={c.consumers.length} label="Consumidores" tone="text" /></Card>
      </div>
      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold"><Gauge className="h-4 w-4 text-accent" strokeWidth={1.5} /> Latência nas últimas 24 h</div>
          <span className="text-xs text-text-muted">p95 {formatNumber(p95)} ms · limite 800 ms</span>
        </div>
        {c.latencyMs ? (
          <div className="relative flex h-28 items-end gap-1" role="img" aria-label={`Latência por hora; p95 ${p95} ms`}>
            <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-warning/50" style={{ bottom: `${(800 / max) * 100}%` }} />
            {series.map((v, i) => (
              <div key={i} title={`${v} ms`} className={cx('flex-1 rounded-t-sm', v > 800 ? 'bg-warning' : 'bg-primary/70')} style={{ height: `${(v / max) * 100}%` }} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-muted">Sem medições ainda: o conector ainda não foi testado.</p>
        )}
      </Card>
      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="p-4 text-sm">
          <div className="text-xs text-text-muted">Modo de sincronização</div>
          <div className="mt-1 font-medium">{SYNC_LABEL[c.syncMode]}</div>
        </Card>
        <Card className="p-4 text-sm">
          <div className="text-xs text-text-muted">Domínio de destino</div>
          <DomainName id={c.domainId} />
        </Card>
      </div>
    </div>
  );
}

function DomainName({ id }: { id?: string }) {
  const ws = useWs();
  const d = ws.domains.find((x) => x.id === id);
  return <div className="mt-1 font-medium">{d ? d.name : 'Sem domínio definido'}</div>;
}

const WRITE_RULE = 'Toda tool de escrita nasce desligada para agentes em Prd e exige política explícita.';

function ToolsTab({ c, canEdit }: { c: Connector; canEdit: boolean }) {
  const ws = useWs();
  const mutate = useCortex((s) => s.mutate);
  const toast = useCortex((s) => s.toast);
  const [blocked, setBlocked] = useState<string | null>(null);

  const toggle = (t: ConnectorTool, env: EnvId) => {
    const on = !t.enabledByEnv[env];
    if (on && env === 'prd' && t.mode === 'escrita' && !t.policyId) {
      setBlocked(t.id);
      return;
    }
    setBlocked(null);
    mutate(
      (d) => {
        const tool = d.connectors.find((x) => x.id === c.id)?.tools.find((x) => x.id === t.id);
        if (tool) tool.enabledByEnv[env] = on;
      },
      { action: `${on ? 'Ligou' : 'Desligou'} tool em ${ENVS[env].label}`, object: t.name },
    );
    toast({ kind: 'info', title: `${t.name} ${on ? 'ligada' : 'desligada'} em ${ENVS[env].label}` });
  };

  if (!c.tools.length) return <EmptyState title="Nenhuma tool exposta" description="As ações do sistema viram tools no passo Mapear e sincronizar do wizard." />;
  return (
    <div className="space-y-3">
      <p className="flex items-start gap-2 text-xs text-text-muted"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />{WRITE_RULE}</p>
      <div className="overflow-auto rounded-card border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface-2">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-text-muted">Tool</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-text-muted">Modo</th>
              {ENV_ORDER.map((e) => (
                <th key={e} className="px-3 py-2 text-center text-xs font-medium text-text-muted"><EnvBadge env={e} /></th>
              ))}
            </tr>
          </thead>
          <tbody>
            {c.tools.map((t) => {
              const pol = t.policyId ? ws.policies.find((x) => x.id === t.policyId) : undefined;
              return (
                <tr key={t.id} className="border-t border-border align-top">
                  <td className="px-3 py-2.5">
                    <Mono className="block">{t.name}</Mono>
                    <span className="block text-xs text-text-muted">{t.description}</span>
                    {pol && <Chip tone="purple" className="mt-1">Política: {pol.name}</Chip>}
                    {blocked === t.id && (
                      <div className="mt-2 flex items-start gap-2 rounded-field border border-warning/40 bg-warning/5 px-3 py-2 text-xs">
                        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                        <span>
                          {WRITE_RULE} Esta tool não tem política vinculada.{' '}
                          <Link href="/governanca" className="text-accent underline">Definir política em Governança</Link>
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2.5"><ModeChip mode={t.mode} /></td>
                  {ENV_ORDER.map((e) => {
                    const on = t.enabledByEnv[e];
                    const locked = e === 'prd' && t.mode === 'escrita' && !t.policyId;
                    return (
                      <td key={e} className="px-3 py-2.5 text-center">
                        <button
                          role="switch"
                          aria-checked={on}
                          aria-label={`${t.name} em ${ENVS[e].label}`}
                          disabled={!canEdit}
                          onClick={() => toggle(t, e)}
                          className={cx(
                            'relative inline-flex h-5 w-9 items-center rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                            on ? 'border-primary bg-primary/30' : 'border-border bg-surface-2',
                          )}
                        >
                          <span className={cx('absolute h-3.5 w-3.5 rounded-full transition-all', on ? 'left-[18px] bg-primary' : 'left-[3px] bg-text-muted')} />
                        </button>
                        <div className="mt-1 text-[10px] text-text-muted">{on ? 'ligada' : locked ? <span className="inline-flex items-center gap-0.5"><Lock className="h-2.5 w-2.5" /> exige política</span> : 'desligada'}</div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Credenciais({ c, canEdit, onDuplicate }: { c: Connector; canEdit: boolean; onDuplicate: () => void }) {
  const mutate = useCortex((s) => s.mutate);
  const toast = useCortex((s) => s.toast);
  const replace = useCortex((s) => s.replaceWorkspace);
  const [confirm, setConfirm] = useState<EnvId | null>(null);

  const revoke = (env: EnvId) => {
    const before = mutate(
      (d) => {
        const x = d.connectors.find((k) => k.id === c.id);
        if (!x) return;
        delete x.envs[env];
        x.logs = [...x.logs, { at: demoNow(), level: 'aviso', message: `Credencial de ${ENVS[env].label} revogada no cofre.` }];
        if (!Object.keys(x.envs).length) x.status = 'pausado';
      },
      { action: `Revogou credencial de ${ENVS[env].label}`, object: c.name },
    );
    setConfirm(null);
    toast({ kind: 'aviso', title: `Credencial de ${ENVS[env].label} revogada`, description: c.name, undo: before ? () => replace(before) : undefined });
  };

  return (
    <div className="space-y-3">
      <p className="flex items-center gap-2 text-xs text-text-muted"><KeyRound className="h-3.5 w-3.5" /> O segredo fica no cofre. Aqui aparecem só o endereço e a referência do segredo.</p>
      {ENV_ORDER.map((e) => {
        const cred = c.envs[e];
        return (
          <Card key={e} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <EnvBadge env={e} />
                {cred ? (
                  <>
                    <div className="text-xs text-text-muted">Endereço</div>
                    <Mono className="block break-all">{cred.endpoint}</Mono>
                    <div className="text-xs text-text-muted">Referência do segredo</div>
                    <Mono className="block break-all text-primary">{cred.secretRef}</Mono>
                  </>
                ) : (
                  <p className="text-sm text-text-muted">
                    {e === 'prd' ? 'Sem credencial. Em Prd o conector só chega por promoção a partir de Hml.' : 'Sem credencial neste ambiente.'}
                  </p>
                )}
              </div>
              {cred ? (
                <div className="flex items-center gap-2">
                  <Chip tone="green" icon={Lock}>No cofre</Chip>
                  <Button size="sm" variant="ghost" icon={ShieldOff} disabled={!canEdit} onClick={() => setConfirm(e)}>Revogar</Button>
                </div>
              ) : (
                <Button size="sm" variant="tertiary" disabled={!canEdit} onClick={onDuplicate}>{e === 'prd' ? 'Promover de Hml' : 'Adicionar ambiente'}</Button>
              )}
            </div>
          </Card>
        );
      })}
      <Modal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={confirm ? `Revogar a credencial de ${ENVS[confirm].label}?` : ''}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)}>Cancelar</Button>
            <Button variant="danger" icon={ShieldOff} onClick={() => confirm && revoke(confirm)}>Revogar</Button>
          </>
        }
      >
        <p className="text-sm">
          O segredo é invalidado no cofre e o conector para de sincronizar em {confirm ? ENVS[confirm].label : ''}.{' '}
          {c.consumers.length > 0 ? `${c.consumers.length} consumidores deixam de receber dados neste ambiente.` : 'Nenhum consumidor depende dele ainda.'}
        </p>
      </Modal>
    </div>
  );
}

const LN_TONE: Record<LineageNode['kind'], GraphTone> = {
  conector: 'green', bronze: 'yellow', prata: 'muted', ouro: 'yellow', contrato: 'lilac', jornada: 'purple', canal: 'muted',
};
const LN_LABEL: Record<LineageNode['kind'], string> = {
  conector: 'conector', bronze: 'Bronze', prata: 'Prata', ouro: 'Ouro', contrato: 'contrato', jornada: 'jornada', canal: 'canal',
};

function Linhagem({ c }: { c: Connector }) {
  const ws = useWs();
  const { nodes, edges } = useMemo(() => {
    const start = `ln-${c.id}`;
    const seen = new Set<string>([start]);
    const q = [start];
    while (q.length) {
      const cur = q.shift()!;
      for (const e of ws.lineage.edges) if (e.source === cur && !seen.has(e.target)) { seen.add(e.target); q.push(e.target); }
    }
    const ns: GraphNode[] = ws.lineage.nodes.filter((n) => seen.has(n.id)).map((n) => ({ id: n.id, label: n.label, sublabel: LN_LABEL[n.kind], tone: LN_TONE[n.kind], glow: n.kind === 'conector' }));
    const es = ws.lineage.edges.filter((e) => seen.has(e.source) && seen.has(e.target));
    if (ns.length) return { nodes: ns, edges: es };
    // Sem linhagem no lakehouse ainda: mostra o conector e seus consumidores diretos.
    const direct: GraphNode[] = [{ id: start, label: c.name, sublabel: 'conector', tone: 'green', glow: true }];
    const dEdges: { source: string; target: string }[] = [];
    for (const id of c.consumers) {
      const k = ws.contracts.find((x) => x.id === id);
      const j = ws.journeys.find((x) => x.id === id);
      const ch = ws.channels.find((x) => x.id === id);
      const label = k?.name ?? j?.name ?? ch?.name;
      if (!label) continue;
      direct.push({ id: `d-${id}`, label, sublabel: k ? 'contrato' : j ? 'jornada' : 'canal', tone: k ? 'lilac' : j ? 'purple' : 'muted' });
      dEdges.push({ source: start, target: `d-${id}` });
    }
    return { nodes: direct, edges: dEdges };
  }, [ws, c]);

  return (
    <div className="space-y-2">
      <p className="text-xs text-text-muted">Do conector às tabelas do lakehouse, contratos, jornadas e canais.</p>
      <Graph nodes={nodes} edges={edges} height={360} />
      {nodes.length === 1 && (
        <p className="text-xs text-text-muted">Ainda sem consumidores: a linhagem cresce quando uma tabela Bronze, um contrato ou uma jornada passar a usar este conector.</p>
      )}
    </div>
  );
}

const LOG_TONE: Record<string, { tone: ChipTone; icon: typeof Info; label: string }> = {
  info: { tone: 'lilac', icon: CheckCircle2, label: 'Info' },
  aviso: { tone: 'yellow', icon: AlertTriangle, label: 'Aviso' },
  erro: { tone: 'red', icon: XCircle, label: 'Erro' },
};

function Logs({ c }: { c: Connector }) {
  const logs = [...c.logs].sort((a, b) => b.at.localeCompare(a.at));
  if (!logs.length) return <EmptyState title="Sem logs" description="Eventos de sincronização, testes e credenciais aparecem aqui." />;
  return (
    <ul className="space-y-1.5">
      {logs.map((l, i) => {
        const t = LOG_TONE[l.level];
        return (
          <li key={i} className="flex items-start gap-3 rounded-field border border-border bg-surface-1 px-3 py-2 text-sm">
            <Chip tone={t.tone} icon={t.icon}>{t.label}</Chip>
            <span className="min-w-0 flex-1">{l.message}</span>
            <Mono className="shrink-0 text-text-muted">{l.at.slice(0, 16).replace('T', ' ')}</Mono>
          </li>
        );
      })}
    </ul>
  );
}

// ---------- Diálogos ----------
export function TestModal({ c, onClose }: { c: Connector | null; onClose: () => void }) {
  const mutate = useCortex((s) => s.mutate);
  const [results, setResults] = useState<CheckResult[]>([]);
  const [running, setRunning] = useState(false);
  const runId = useRef(0);

  const run = async (conn: Connector) => {
    const my = ++runId.current;
    const env = ENV_ORDER.find((e) => conn.envs[e]);
    const cred = env ? conn.envs[env] : undefined;
    const plan = planChecks(cred?.endpoint ?? '', !!cred, conn.latencyMs || undefined);
    setRunning(true);
    setResults(plan.map((r) => ({ key: r.key, status: 'pendente' })));
    for (let i = 0; i < plan.length; i++) {
      if (plan[i].status === 'pendente' || runId.current !== my) break;
      setResults((rs) => rs.map((r, j) => (j === i ? { ...r, status: 'rodando' } : r)));
      await sleep(Math.min(800, 320 + (plan[i].ms ?? 200)));
      if (runId.current !== my) return;
      setResults((rs) => rs.map((r, j) => (j === i ? plan[i] : r)));
      if (plan[i].status === 'falha') break;
    }
    setRunning(false);
    const ok = plan.every((r) => r.status === 'ok');
    mutate((d) => {
      const x = d.connectors.find((k) => k.id === conn.id);
      if (x) x.logs = [...x.logs, { at: demoNow(), level: ok ? 'info' : 'erro', message: ok ? 'Teste de saúde: rede, autenticação, permissão e latência ok.' : 'Teste de saúde falhou; veja a causa no detalhe.' }];
    });
  };

  useEffect(() => {
    if (c) void run(c);
    else runId.current++;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c?.id]);

  return (
    <Modal
      open={!!c}
      onClose={onClose}
      title={c ? `Testar ${c.name}` : ''}
      subtitle="Rede, autenticação, permissão e latência, em sequência"
      footer={
        <>
          <Button variant="tertiary" icon={RefreshCw} loading={running} onClick={() => c && void run(c)}>Testar novamente</Button>
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
        </>
      }
    >
      <ChecksList results={results} />
    </Modal>
  );
}

function endpointFor(c: Connector, target: EnvId): string {
  const src = ENV_ORDER.map((e) => c.envs[e]).find(Boolean)?.endpoint ?? '';
  if (/-(dev|hml)\./.test(src)) return src.replace(/-(dev|hml)\./, target === 'prd' ? '.' : `-${target}.`);
  return src;
}

export function DuplicateModal({ c, onClose }: { c: Connector | null; onClose: () => void }) {
  const ws = useWs();
  const mutate = useCortex((s) => s.mutate);
  const toast = useCortex((s) => s.toast);
  const replace = useCortex((s) => s.replaceWorkspace);
  const missing = c ? ENV_ORDER.filter((e) => !c.envs[e]) : [];
  const [target, setTarget] = useState<EnvId | null>(null);
  useEffect(() => setTarget(missing.find((e) => e !== 'prd' || c?.envs.hml) ?? null), [c?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!c) return null;
  const prdBlocked = (e: EnvId) => e === 'prd' && !c.envs.hml;

  const confirm = () => {
    if (!target) return;
    const before = mutate(
      (d) => {
        const x = d.connectors.find((k) => k.id === c.id);
        if (!x) return;
        x.envs[target] = { endpoint: endpointFor(c, target), secretRef: secretRefFor(ws.workspace.id, c.id, target) };
        x.logs = [...x.logs, { at: demoNow(), level: 'info', message: target === 'prd' ? 'Promovido de Hml para Prd; credencial de Prd criada no cofre.' : `Duplicado para ${ENVS[target].label}; credencial criada no cofre.` }];
      },
      { action: target === 'prd' ? 'Promoveu conector para Prd' : `Duplicou conector para ${ENVS[target].label}`, object: c.name },
    );
    toast({ kind: 'sucesso', title: target === 'prd' ? `${c.name} promovido para Prd` : `${c.name} disponível em ${ENVS[target].label}`, undo: before ? () => replace(before) : undefined });
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Duplicar ${c.name} para outro ambiente`}
      subtitle="A configuração é copiada; o segredo de cada ambiente fica no cofre"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" icon={Copy} disabled={!target || prdBlocked(target)} onClick={confirm}>{target === 'prd' ? 'Promover para Prd' : 'Duplicar'}</Button>
        </>
      }
    >
      {missing.length === 0 ? (
        <p className="text-sm text-text-muted">Este conector já está em Dev, Hml e Prd.</p>
      ) : (
        <div className="space-y-2">
          {missing.map((e) => (
            <button
              key={e}
              disabled={prdBlocked(e)}
              onClick={() => setTarget(e)}
              className={cx('flex w-full items-start gap-3 rounded-card border px-3 py-2.5 text-left disabled:cursor-not-allowed disabled:opacity-60', target === e ? 'border-primary bg-primary/10' : 'border-border hover:bg-surface-2')}
            >
              <EnvBadge env={e} />
              <span className="min-w-0 flex-1 text-sm">
                <Mono className="block break-all">{endpointFor(c, e) || 'endereço a definir'}</Mono>
                <span className="block text-xs text-text-muted">
                  {e === 'prd'
                    ? c.envs.hml
                      ? 'Promoção a partir de Hml: o único caminho para Prd.'
                      : 'Um conector em Prd só é criado por promoção a partir de Hml. Duplique para Hml primeiro.'
                    : ENVS[e].purpose}
                </span>
              </span>
              {prdBlocked(e) && <Lock className="h-4 w-4 text-warning" />}
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}

export function EditMappingModal({ c, onClose }: { c: Connector | null; onClose: () => void }) {
  const ws = useWs();
  const mutate = useCortex((s) => s.mutate);
  const toast = useCortex((s) => s.toast);
  const [domainId, setDomainId] = useState('');
  const [syncMode, setSyncMode] = useState<SyncMode>('agendado');
  useEffect(() => {
    if (c) {
      setDomainId(c.domainId ?? ws.domains[0]?.id ?? '');
      setSyncMode(c.syncMode);
    }
  }, [c?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!c) return null;
  const save = () => {
    mutate(
      (d) => {
        const x = d.connectors.find((k) => k.id === c.id);
        if (!x) return;
        x.domainId = domainId;
        x.syncMode = syncMode;
        x.logs = [...x.logs, { at: demoNow(), level: 'info', message: `Mapeamento atualizado: ${ws.domains.find((k) => k.id === domainId)?.name ?? domainId}, ${SYNC_LABEL[syncMode].toLowerCase()}.` }];
      },
      { action: 'Editou mapeamento do conector', object: c.name },
    );
    toast({ kind: 'sucesso', title: 'Mapeamento salvo', description: c.name });
    onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={`Editar mapeamento · ${c.name}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={save}>Salvar</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Domínio de destino">
          <Select value={domainId} onChange={(e) => setDomainId(e.target.value)} options={ws.domains.map((d) => ({ value: d.id, label: d.name }))} />
        </Field>
        <Field label="Modo de sincronização">
          <Select value={syncMode} onChange={(e) => setSyncMode(e.target.value as SyncMode)} options={(Object.keys(SYNC_LABEL) as SyncMode[]).map((m) => ({ value: m, label: SYNC_LABEL[m] }))} />
        </Field>
        <p className="text-xs text-text-muted">Objetos mapeados: {c.objects.map((o) => o.name).join(', ') || 'nenhum'}.</p>
      </div>
    </Modal>
  );
}

export function RemoveModal({ c, onClose, onRemoved }: { c: Connector | null; onClose: () => void; onRemoved: () => void }) {
  const ws = useWs();
  const mutate = useCortex((s) => s.mutate);
  const toast = useCortex((s) => s.toast);
  const replace = useCortex((s) => s.replaceWorkspace);
  if (!c) return null;
  const impact = computeImpact(ws, c);
  const n = impactCount(impact);
  const groups: [string, { id: string; name: string }[]][] = [
    ['Domínios', impact.domains],
    ['Tabelas do lakehouse', impact.tables],
    ['Contratos', impact.contracts],
    ['Jornadas', impact.journeys],
    ['Canais', impact.channels],
  ];
  const remove = () => {
    const before = mutate(
      (d) => {
        d.connectors = d.connectors.filter((k) => k.id !== c.id);
        d.systems.forEach((s) => {
          if (s.connectorId === c.id) delete s.connectorId;
        });
      },
      { action: 'Revogou e removeu conector', object: c.name },
    );
    toast({ kind: 'aviso', title: `${c.name} removido`, description: 'Credenciais revogadas no cofre.', undo: before ? () => replace(before) : undefined });
    onRemoved();
  };
  return (
    <Modal
      open
      onClose={onClose}
      width={600}
      title={`Revogar e remover ${c.name}?`}
      subtitle="Antes de remover, veja o que depende deste conector"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="danger" icon={Trash2} onClick={remove}>{n > 0 ? `Remover mesmo assim (${n} impactados)` : 'Remover conector'}</Button>
        </>
      }
    >
      {n === 0 ? (
        <div className="flex items-start gap-3 rounded-card border border-primary/40 bg-primary/5 p-3 text-sm">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          Nenhum domínio, contrato, jornada ou canal depende deste conector. As credenciais são revogadas no cofre.
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-start gap-3 rounded-card border border-danger/40 bg-danger/5 p-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
            {n} itens dependem deste conector. Jornadas e canais listados deixam de receber dados e as tools somem dos agentes.
          </div>
          {groups.filter(([, xs]) => xs.length).map(([label, xs]) => (
            <div key={label}>
              <div className="mb-1 text-xs font-medium text-text-muted">{label} ({xs.length})</div>
              <div className="flex flex-wrap gap-1.5">{xs.map((x) => <Chip key={x.id} tone="red">{x.name}</Chip>)}</div>
            </div>
          ))}
          {c.tools.length > 0 && (
            <div>
              <div className="mb-1 text-xs font-medium text-text-muted">Tools expostas ({c.tools.length})</div>
              <div className="flex flex-wrap gap-1.5">{c.tools.map((t) => <Chip key={t.id} tone="muted"><Mono>{t.name}</Mono></Chip>)}</div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
