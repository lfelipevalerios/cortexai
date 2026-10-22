'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Boxes, Search } from 'lucide-react';
import { COMPONENT_TYPES, ENVS, type ComponentStatus, type ComponentType, type EnvId } from '@cortex/schemas';
import { useEnv, useWs } from '@/lib/store';
import { Button, EmptyState, EnvBadge, Input, PageHeader, Select, StatusChip, cx } from '@/components/ui';
import { ComponentCard } from '@/components/catalogo/ComponentCard';
import { ComponentDrawer } from '@/components/catalogo/ComponentDrawer';
import { LIFECYCLE, availableEnvs } from '@/components/catalogo/lib';
import { prefixOf } from '@/components/cerebro/lib';

export default function CatalogoPage() {
  return (
    <Suspense fallback={null}>
      <Catalogo />
    </Suspense>
  );
}

const STATUS_ORDER: Record<ComponentStatus, number> = { publicado_prd: 0, homologado: 1, em_revisao: 2, rascunho: 3, depreciado: 4 };

function Catalogo() {
  const ws = useWs();
  const env = useEnv();
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState('');
  const [type, setType] = useState<'todos' | ComponentType>('todos');
  const [domain, setDomain] = useState('todos');
  const [status, setStatus] = useState<'todos' | ComponentStatus>('todos');
  const [envFilter, setEnvFilter] = useState<'todos' | EnvId>('todos');
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    const id = params.get('id');
    setOpenId(id && ws.components.some((c) => c.id === id) ? id : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, ws.workspace.id]);

  const showcaseId = `${prefixOf(ws)}-cp-rule-showcase`;

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return ws.components
      .filter((c) => type === 'todos' || c.type === type)
      .filter((c) => domain === 'todos' || (domain === 'transversal' ? !c.domainId : c.domainId === domain))
      .filter((c) => status === 'todos' || c.status === status)
      .filter((c) => envFilter === 'todos' || availableEnvs(c.status).includes(envFilter))
      .filter((c) => !term || `${c.name} ${c.description} ${c.owner}`.toLowerCase().includes(term))
      .sort((a, b) => (a.id === showcaseId ? -1 : b.id === showcaseId ? 1 : STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.name.localeCompare(b.name, 'pt-BR')));
  }, [ws.components, q, type, domain, status, envFilter, showcaseId]);

  const inEnv = ws.components.filter((c) => availableEnvs(c.status).includes(env)).length;
  const targetId = filtered.some((c) => c.id === showcaseId) ? showcaseId : filtered[0]?.id;
  const open = openId ? ws.components.find((c) => c.id === openId) ?? null : null;
  const counts = LIFECYCLE.map((s) => ({ ...s, n: ws.components.filter((c) => c.status === s.id).length }));
  const anyFilter = q || type !== 'todos' || domain !== 'todos' || status !== 'todos' || envFilter !== 'todos';

  const openComponent = (id: string) => {
    setOpenId(id);
    router.replace(`/catalogo?id=${encodeURIComponent(id)}`, { scroll: false });
  };
  const close = () => {
    setOpenId(null);
    router.replace('/catalogo', { scroll: false });
  };

  return (
    <div>
      <PageHeader
        title="Catálogo de componentes"
        subtitle="Skills, agents, rules, MCPs, hooks, documentos e pacotes versionados. Tudo o que o cérebro sabe vira componente que jornadas, agentes e IDEs reaproveitam, com homologação do CoE AI."
        actions={
          <span className="flex items-center gap-2 rounded-full border border-border bg-surface-1 px-3 py-1.5 text-xs text-text-muted">
            Disponíveis em <EnvBadge env={env} /> <b className="font-semibold text-text">{inEnv}</b> de {ws.components.length}
          </span>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {counts.map((s) => (
          <button
            key={s.id}
            onClick={() => setStatus(status === s.id ? 'todos' : s.id)}
            className={cx('rounded-full', status === s.id && 'ring-2 ring-primary/60')}
            aria-pressed={status === s.id}
          >
            <StatusChip status={s.id} label={`${s.label} · ${s.n}`} />
          </button>
        ))}
      </div>

      <div className="mb-5 grid gap-3 rounded-card border border-border bg-surface-1 p-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,1fr))]">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome, descrição ou dono" className="pl-9" aria-label="Buscar componentes" />
        </label>
        <Select aria-label="Tipo" value={type} onChange={(e) => setType(e.target.value as typeof type)} options={[{ value: 'todos', label: 'Todos os tipos' }, ...(Object.keys(COMPONENT_TYPES) as ComponentType[]).map((t) => ({ value: t, label: COMPONENT_TYPES[t].label }))]} />
        <Select aria-label="Domínio" value={domain} onChange={(e) => setDomain(e.target.value)} options={[{ value: 'todos', label: 'Todos os domínios' }, ...ws.domains.map((d) => ({ value: d.id, label: d.name })), { value: 'transversal', label: 'Transversal' }]} />
        <Select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value as typeof status)} options={[{ value: 'todos', label: 'Todos os status' }, ...LIFECYCLE.map((s) => ({ value: s.id, label: s.label }))]} />
        <Select
          aria-label="Ambiente"
          value={envFilter}
          onChange={(e) => setEnvFilter(e.target.value as typeof envFilter)}
          options={[
            { value: 'todos', label: 'Todos os ambientes' },
            { value: 'dev', label: `${ENVS.dev.label}: em revisão em diante` },
            { value: 'hml', label: `${ENVS.hml.label}: homologados` },
            { value: 'prd', label: `${ENVS.prd.label}: publicados em Prd` },
          ]}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title={anyFilter ? 'Nenhum componente com esses filtros' : 'Catálogo vazio'}
          description={anyFilter ? 'Ajuste os filtros para ver mais componentes.' : 'Publique uma regra ou documento do cérebro como componente para começar.'}
          action={anyFilter ? <Button variant="tertiary" onClick={() => { setQ(''); setType('todos'); setDomain('todos'); setStatus('todos'); setEnvFilter('todos'); }}>Limpar filtros</Button> : <Button variant="primary" onClick={() => router.push('/cerebro?area=area-regras')}>Abrir regras no Cérebro</Button>}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filtered.map((c) => (
            <ComponentCard key={c.id} c={c} env={env} featured={c.id === showcaseId} tourTarget={c.id === targetId} onOpen={() => openComponent(c.id)} />
          ))}
        </div>
      )}

      <ComponentDrawer component={open} onClose={close} onOpen={openComponent} />
    </div>
  );
}
