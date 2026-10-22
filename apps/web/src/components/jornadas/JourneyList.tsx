'use client';

// Lista de jornadas: tipo, domínio, risco, versão por ambiente e "Nova jornada".
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bot, Cog, Plus, Star, Workflow } from 'lucide-react';
import { ENV_ORDER } from '@cortex/schemas';
import { Button, Chip, EnvBadge, Mono, PageHeader, StatusChip, Table, useCan } from '@/components/ui';
import { useWs } from '@/lib/store';
import { RISK_LABEL } from '@/components/studio/lib';
import { NewJourneyModal } from './NewJourneyModal';

export function JourneyList() {
  const ws = useWs();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const canCreate = useCan('editar_jornada');
  const domainName = (id: string) => ws.domains.find((d) => d.id === id)?.name ?? id;

  return (
    <div>
      <PageHeader
        title="Jornadas"
        subtitle="Fluxos de caixinhas que viram atendimento, automação ou agente. Abra no Studio para desenhar, testar com persona e promover entre ambientes."
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setOpen(true)}>
            Nova jornada
          </Button>
        }
      />
      <Table
        rows={ws.journeys}
        rowKey={(j) => j.id}
        onRowClick={(j) => router.push(`/jornadas/studio?id=${encodeURIComponent(j.id)}`)}
        columns={[
          {
            key: 'nome',
            header: 'Jornada',
            render: (j) => (
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Workflow className="h-4 w-4 shrink-0 text-accent" strokeWidth={1.5} />
                  <span className="font-medium">{j.name}</span>
                  {j.anchor && <Chip tone="green" icon={Star}>Jornada do roteiro</Chip>}
                </div>
                <div className="mt-0.5 max-w-xl truncate pl-6 text-xs text-text-muted">{j.description}</div>
              </div>
            ),
          },
          {
            key: 'tipo',
            header: 'Tipo',
            render: (j) => (j.type === 'agentica' ? <Chip tone="purple" icon={Bot}>Agêntica</Chip> : <Chip tone="lilac" icon={Cog}>Automação</Chip>),
          },
          { key: 'dominio', header: 'Domínio', render: (j) => <span className="text-sm">{domainName(j.domainId)}</span> },
          { key: 'risco', header: 'Classe de risco', render: (j) => <span className="text-sm">{RISK_LABEL[j.risk]}</span> },
          {
            key: 'versoes',
            header: 'Versão por ambiente',
            render: (j) => (
              <div className="flex flex-wrap items-center gap-2">
                {ENV_ORDER.map((e) => (
                  <span key={e} className="inline-flex items-center gap-1">
                    <EnvBadge env={e} />
                    <Mono className={j.envVersions[e] ? '' : 'text-text-muted'}>{j.envVersions[e] ?? '—'}</Mono>
                  </span>
                ))}
              </div>
            ),
          },
          {
            key: 'testes',
            header: 'Casos de teste',
            render: (j) => {
              const failed = j.testCases.filter((c) => c.lastResult === 'falhou').length;
              return j.testCases.length === 0 ? (
                <span className="text-xs text-text-muted">Nenhum</span>
              ) : failed ? (
                <StatusChip status="falhou" label={`${failed} de ${j.testCases.length} falhando`} />
              ) : (
                <StatusChip status="passou" label={`${j.testCases.length} passando`} />
              );
            },
          },
        ]}
        actions={(j) => (
          <Button size="sm" variant="tertiary" onClick={(e) => { e.stopPropagation(); router.push(`/jornadas/studio?id=${encodeURIComponent(j.id)}`); }}>
            Abrir no Studio
          </Button>
        )}
      />
      {open && <NewJourneyModal canCreate={canCreate} onClose={() => setOpen(false)} />}
    </div>
  );
}
