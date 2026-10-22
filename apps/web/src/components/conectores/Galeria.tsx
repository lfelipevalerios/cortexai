'use client';

import { useMemo, useState } from 'react';
import { Search, Plug, FlaskConical, SearchX } from 'lucide-react';
import { CONNECTOR_CATEGORIES, type ConnectorCategory, type ConnectorType } from '@cortex/schemas';
import { CONNECTOR_TYPES } from '@cortex/seed';
import { Button, Card, Chip, EmptyState, IconCircle, Input, cx } from '@/components/ui';
import { useWs } from '@/lib/store';
import { AUTH_LABEL, BADGE_TONE, CATEGORY_ICON } from './helpers';

export function Galeria({ crmTypeId, canCreate, onConnect }: { crmTypeId: string; canCreate: boolean; onConnect: (t: ConnectorType) => void }) {
  const ws = useWs();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<ConnectorCategory | 'todas'>('todas');

  const types = useMemo(
    () => CONNECTOR_TYPES.filter((t) => !t.industry || t.industry === ws.workspace.industry),
    [ws.workspace.industry],
  );
  const inUse = useMemo(() => {
    const m = new Map<string, number>();
    ws.connectors.forEach((c) => m.set(c.typeId, (m.get(c.typeId) ?? 0) + 1));
    return m;
  }, [ws.connectors]);

  const term = q.trim().toLowerCase();
  const filtered = types.filter(
    (t) => (cat === 'todas' || t.category === cat) && (!term || `${t.name} ${t.description} ${CONNECTOR_CATEGORIES[t.category]}`.toLowerCase().includes(term)),
  );
  const cats = (Object.keys(CONNECTOR_CATEGORIES) as ConnectorCategory[]).filter((c) => types.some((t) => t.category === c));

  return (
    <div data-tour="conectores-galeria" className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" strokeWidth={1.5} />
          <Input aria-label="Buscar conector" placeholder="Buscar sistema ou categoria" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por categoria">
          {(['todas', ...cats] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={cx(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                cat === c ? 'border-primary bg-primary/10 text-primary' : 'border-border text-text-muted hover:text-text',
              )}
            >
              {c === 'todas' ? 'Todas' : CONNECTOR_CATEGORIES[c]}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 && (
        <EmptyState icon={SearchX} title="Nenhum conector encontrado" description="Tente outro termo ou limpe o filtro de categoria. Qualquer API documentada pode entrar pelo Importar OpenAPI."
          action={<Button variant="tertiary" size="sm" onClick={() => { setQ(''); setCat('todas'); }}>Limpar filtros</Button>} />
      )}

      {cats
        .filter((c) => filtered.some((t) => t.category === c))
        .map((c) => (
          <section key={c}>
            <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
              {CONNECTOR_CATEGORIES[c]}
              <span className="font-normal normal-case">({filtered.filter((t) => t.category === c).length})</span>
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {filtered
                .filter((t) => t.category === c)
                .map((t) => {
                  const n = inUse.get(t.id) ?? 0;
                  const isCrm = t.id === crmTypeId;
                  return (
                    <Card
                      key={t.id}
                      data-tour={isCrm ? 'conector-card-crm' : undefined}
                      halo={isCrm && n === 0 ? 'purple' : undefined}
                      className="flex flex-col p-4 transition-colors hover:border-accent/60"
                    >
                      <div className="flex items-start gap-3">
                        <IconCircle icon={CATEGORY_ICON[t.category]} tone={t.real ? 'green' : 'purple'} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold">{t.name}</div>
                          <div className="text-xs text-text-muted">{AUTH_LABEL[t.auth]}</div>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <Chip tone={BADGE_TONE[t.badge]}>{t.badge}</Chip>
                        {t.real && <Chip tone="green" icon={FlaskConical}>Real</Chip>}
                        {t.industry && <Chip tone="muted">Setorial</Chip>}
                        {n > 0 && <Chip tone="muted" icon={Plug}>{n === 1 ? '1 em uso' : `${n} em uso`}</Chip>}
                      </div>
                      <p className="mt-2 flex-1 text-xs text-text-muted">{t.description}</p>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        {isCrm ? <span className="text-[11px] text-accent">CRM da empresa</span> : <span />}
                        <Button size="sm" variant={isCrm ? 'primary' : 'tertiary'} disabled={!canCreate} onClick={() => onConnect(t)} title={canCreate ? undefined : 'Seu perfil não pode cadastrar conectores'}>
                          Conectar
                        </Button>
                      </div>
                    </Card>
                  );
                })}
            </div>
          </section>
        ))}
    </div>
  );
}
