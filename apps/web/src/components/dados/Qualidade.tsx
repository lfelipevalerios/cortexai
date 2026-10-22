'use client';

import { useMemo } from 'react';
import type { DataClassification, EnvId, ProfileId, WorkspaceData } from '@cortex/schemas';
import { ENVS, ENV_ORDER, PROFILES } from '@cortex/schemas';
import { latestContractVersion } from '@cortex/engine';
import { AlertTriangle, ShieldCheck, EyeOff, Eye, Ban, FlaskConical, Sigma } from 'lucide-react';
import { Card, CardHeader, Chip, StatusChip, Mono, EnvBadge, cx, type ChipTone } from '@/components/ui';
import { EChart } from '@/components/ui/EChart';
import { useEnv, useProfile } from '@/lib/store';
import { CLASSIFICATION, ClassChip } from './shared';

const KIND_LABEL: Record<string, string> = { completude: 'Completude', unicidade: 'Unicidade', faixa: 'Faixa', frescor: 'Frescor', volume: 'Volume' };

type Access = 'sintetico' | 'mascarado' | 'aberto' | 'agregado' | 'sem_acesso';
const ACCESS: Record<Access, { label: string; tone: ChipTone; icon: typeof Eye }> = {
  sintetico: { label: 'Sintético', tone: 'lilac', icon: FlaskConical },
  mascarado: { label: 'Mascarado', tone: 'yellow', icon: EyeOff },
  aberto: { label: 'Aberto, auditado', tone: 'green', icon: Eye },
  agregado: { label: 'Só agregado', tone: 'purple', icon: Sigma },
  sem_acesso: { label: 'Sem acesso', tone: 'muted', icon: Ban },
};

/** Mascaramento de dado pessoal por perfil e ambiente. Hml nunca recebe dado pessoal aberto. */
function accessFor(profile: ProfileId, env: EnvId): Access {
  if (profile === 'admin') return 'sem_acesso';
  if (env === 'dev') return 'sintetico';
  if (env === 'hml') return profile === 'patrocinador' ? 'agregado' : 'mascarado';
  if (profile === 'patrocinador') return 'agregado';
  if (profile === 'dono_negocio' || profile === 'seguranca') return 'aberto';
  return 'mascarado';
}

export function QualidadeTab({ ws }: { ws: WorkspaceData }) {
  const env = useEnv();
  const profile = useProfile();
  const userName = (id: string) => ws.users.find((u) => u.id === id || u.name === id)?.name ?? id;

  const rules = useMemo(
    () =>
      ws.contracts.flatMap((c) => {
        const v = latestContractVersion(c);
        const dom = ws.domains.find((d) => d.id === c.domainId);
        return (v?.quality ?? []).map((q) => ({ c, q, v, dom }));
      }).sort((a, b) => (a.q.lastResult === b.q.lastResult ? 0 : a.q.lastResult === 'falha' ? -1 : 1)),
    [ws],
  );
  const failing = rules.filter((r) => r.q.lastResult === 'falha').length;

  const classCount = useMemo(() => {
    const m: Record<DataClassification, number> = { pii: 0, sensivel: 0, interno: 0, publico: 0 };
    ws.contracts.forEach((c) => latestContractVersion(c)?.fields.forEach((f) => m[f.classification]++));
    return m;
  }, [ws]);
  const piiColumns = ws.tables.reduce((n, t) => n + t.columns.filter((c) => c.pii).length, 0);

  return (
    <div className="space-y-6">
      <section>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold">Testes de qualidade</h2>
          <Chip tone="muted">{rules.length} regras</Chip>
          {failing > 0 ? <StatusChip status="falha" label={`${failing} falhando`} /> : <StatusChip status="ok" label="Todas passando" />}
        </div>
        <p className="mb-3 text-sm text-text-muted">Cada regra de contrato vira um teste com histórico. Falhas abrem incidente vinculado ao dono do domínio.</p>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rules.map(({ c, q, dom }) => {
            const fail = q.lastResult === 'falha';
            return (
              <Card key={q.id} halo={fail ? 'red' : undefined} className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{KIND_LABEL[q.kind]}{q.field ? ` · ${q.field}` : ''}</div>
                    <div className="truncate text-xs text-text-muted">{c.name}</div>
                  </div>
                  <StatusChip status={q.lastResult} />
                </div>
                <Mono className="mt-1 block truncate text-accent-soft">{q.expression}</Mono>
                <EChart
                  height={80}
                  option={{
                    grid: { left: 4, right: 4, top: 8, bottom: 4, containLabel: false },
                    xAxis: { type: 'category', show: false, data: q.history.map((_, i) => `execução ${i + 1}`) },
                    yAxis: { type: 'value', show: false, min: 80, max: 100 },
                    tooltip: { trigger: 'axis', valueFormatter: (v) => `${Number(v).toFixed(1)}%` },
                    series: [{ type: 'line', data: q.history, smooth: true, symbol: 'none', lineStyle: { width: 2, color: fail ? '#FF7A9A' : '#00FF95' }, areaStyle: { opacity: 0.08, color: fail ? '#FF7A9A' : '#00FF95' } }],
                  }}
                />
                {fail && (
                  <div className="mt-2 flex items-start gap-2 rounded-field border border-danger/40 bg-danger/5 px-2.5 py-2 text-xs">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger" strokeWidth={1.5} />
                    <span>
                      Incidente <Mono>INC-{q.id.slice(-4).toUpperCase()}</Mono> vinculado ao dono do domínio {dom?.name}: <span className="font-medium">{userName(dom?.owner ?? c.owner)}</span>
                    </span>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Card>
          <CardHeader title="Classificação automática" subtitle="Campos dos contratos vigentes" icon={ShieldCheck} />
          <div className="space-y-2 p-4">
            {(Object.keys(CLASSIFICATION) as DataClassification[]).map((k) => (
              <div key={k} className="flex items-center justify-between">
                <ClassChip value={k} />
                <span className="font-mono text-sm">{classCount[k]}</span>
              </div>
            ))}
            <p className="pt-2 text-xs text-text-muted">{piiColumns} colunas com PII detectadas no lakehouse, tratadas a partir da camada Prata.</p>
          </div>
        </Card>
        <Card>
          <CardHeader title="Mascaramento por perfil e ambiente" subtitle="Hml nunca recebe dado pessoal aberto" icon={EyeOff} />
          <div className="overflow-auto p-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-text-muted">
                  <th className="py-2 pr-3 font-medium">Perfil</th>
                  {ENV_ORDER.map((e) => (
                    <th key={e} className="px-2 py-2 font-medium"><EnvBadge env={e} /></th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(Object.keys(PROFILES) as ProfileId[]).map((p) => (
                  <tr key={p} className={cx('border-t border-border', p === profile && 'bg-surface-2')}>
                    <td className="py-2 pr-3">
                      {PROFILES[p].label}
                      {p === profile && <span className="ml-1 text-xs text-primary">(você)</span>}
                    </td>
                    {ENV_ORDER.map((e) => {
                      const a = ACCESS[accessFor(p, e)];
                      return (
                        <td key={e} className={cx('px-2 py-2', p === profile && e === env && 'ring-1 ring-inset ring-primary/60')}>
                          <Chip tone={a.tone} icon={a.icon}>{a.label}</Chip>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-text-muted">
              Dev trabalha com dados sintéticos; {ENVS.hml.label} recebe somente dado mascarado; em {ENVS.prd.label}, abertura só para quem tem finalidade, com auditoria.
            </p>
          </div>
        </Card>
      </section>
    </div>
  );
}
