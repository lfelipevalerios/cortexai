'use client';

import Link from 'next/link';
import { ShieldCheck, UserCheck, Bot, Eye } from 'lucide-react';
import { ENV_ORDER, type Journey, type Policy } from '@cortex/schemas';
import { useCortex, useWs } from '@/lib/store';
import { Card, CardHeader, Chip, EnvBadge, Select, useCan, EmptyState } from '@/components/ui';
import { EFFECT_META, RISK_META } from './shared';
import { codeToRows } from './policy-code';

const RISKS: Journey['risk'][] = ['assistida', 'supervisionada', 'autonoma'];
const RISK_ICON = { assistida: UserCheck, supervisionada: Eye, autonoma: Bot };

/** Políticas que valem para a jornada: ambiente onde ela existe + condições de risco/tipo, se houver. */
export function policiesFor(j: Journey, policies: Policy[]): { policy: Policy; satisfied: boolean }[] {
  const envs = ENV_ORDER.filter((e) => j.envVersions[e] || e === 'dev');
  return policies
    .filter((p) => p.active && p.envs.some((e) => envs.includes(e)))
    .filter((p) => {
      const rows = codeToRows(p.code)?.rows ?? [];
      return rows.every((r) => {
        if (r.field !== 'risk' && r.field !== 'journeyType') return true;
        const actual = r.field === 'risk' ? j.risk : j.type;
        const vals = r.value.split(',').map((v) => v.trim().toLowerCase());
        const hit = vals.includes(actual);
        return r.op === 'neq' ? !hit : hit;
      });
    })
    // Na jornada assistida, a pessoa já decide cada passo: exigência de aprovação fica satisfeita.
    .map((p) => ({ policy: p, satisfied: j.risk === 'assistida' && p.effect === 'exigir_aprovacao' }));
}

export function RiskTab() {
  const ws = useWs();
  const canEdit = useCan('editar_politica');
  const mutate = useCortex((s) => s.mutate);
  const replace = useCortex((s) => s.replaceWorkspace);
  const toast = useCortex((s) => s.toast);

  const reclassify = (j: Journey, risk: Journey['risk']) => {
    const before = mutate((d) => {
      const x = d.journeys.find((y) => y.id === j.id);
      if (x) x.risk = risk;
    }, { action: `Reclassificou risco da jornada para ${RISK_META[risk].label.toLowerCase()}`, object: j.name });
    toast({ kind: 'sucesso', title: `“${j.name}” agora é ${RISK_META[risk].label.toLowerCase()}`, description: 'As políticas aplicáveis foram recalculadas.', undo: before ? () => replace(before) : undefined });
  };

  if (ws.journeys.length === 0) return <EmptyState title="Nenhuma jornada" description="Jornadas criadas no Studio aparecem aqui com sua classificação de risco." />;

  return (
    <div className="space-y-4">
      <p className="max-w-3xl text-sm text-text-muted">A classificação de risco define quais políticas se aplicam a cada jornada. {canEdit ? 'Altere a classificação para ver as políticas mudarem.' : 'Somente CoE AI ou Segurança e compliance reclassificam jornadas.'}</p>
      <div className="grid gap-4 lg:grid-cols-3">
        {RISKS.map((risk) => {
          const js = ws.journeys.filter((j) => j.risk === risk);
          const Icon = RISK_ICON[risk];
          return (
            <Card key={risk} className="flex flex-col">
              <CardHeader icon={Icon} title={<span className="flex items-center gap-2">{RISK_META[risk].label} <Chip tone={RISK_META[risk].tone}>{js.length}</Chip></span>} subtitle={RISK_META[risk].help} />
              <div className="flex-1 space-y-3 p-3">
                {js.length === 0 && <p className="px-1 py-4 text-center text-xs text-text-muted">Nenhuma jornada nesta classificação.</p>}
                {js.map((j) => {
                  const ps = policiesFor(j, ws.policies);
                  return (
                    <div key={j.id} className="rounded-field border border-border bg-surface-2/40 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <Link href={`/jornadas/studio?id=${j.id}`} className="text-sm font-medium hover:text-primary">{j.name}</Link>
                        <div className="flex gap-1">{ENV_ORDER.filter((e) => j.envVersions[e]).map((e) => <EnvBadge key={e} env={e} />)}</div>
                      </div>
                      <div className="mt-1 text-xs text-text-muted">{j.type === 'agentica' ? 'Agêntica' : 'Automação'} · {ps.length} {ps.length === 1 ? 'política se aplica' : 'políticas se aplicam'}</div>
                      <ul className="mt-2 space-y-1">
                        {ps.map(({ policy: p, satisfied }) => (
                          <li key={p.id} className="flex items-start gap-2 text-xs">
                            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                            <span className="flex-1">{p.name}{satisfied && <span className="text-text-muted"> (atendida pela intervenção humana)</span>}</span>
                            <Chip tone={satisfied ? 'muted' : EFFECT_META[p.effect].tone}>{EFFECT_META[p.effect].label}</Chip>
                          </li>
                        ))}
                      </ul>
                      {canEdit && (
                        <div className="mt-3">
                          <Select
                            aria-label={`Classificação de risco de ${j.name}`}
                            value={j.risk}
                            onChange={(e) => reclassify(j, e.target.value as Journey['risk'])}
                            options={RISKS.map((r) => ({ value: r, label: `Classificar como ${RISK_META[r].label.toLowerCase()}` }))}
                            className="py-1 text-xs"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
