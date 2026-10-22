'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, X, FileEdit, Lock, MessageSquare, Send, Inbox, ArrowRight, Boxes, FileText, GitPullRequestArrow, KeyRound, type LucideIcon } from 'lucide-react';
import { PROFILES, type Approval } from '@cortex/schemas';
import { demoNow, useCortex, useProfile, useWs } from '@/lib/store';
import { emitTourAction } from '@/lib/tour-bus';
import { Button, Card, CardHeader, Chip, DiffView, EmptyState, Field, Modal, Mono, StatusChip, Textarea, Tabs, cx } from '@/components/ui';
import { KIND_LABEL, decideApproval, splitDiff, type Decision } from './approvals-logic';
import { fmtDateTime, journeyIdFromObject } from './shared';

const KIND_ICON: Record<Approval['kind'], LucideIcon> = { componente: Boxes, contrato: FileText, promocao: GitPullRequestArrow, acesso: KeyRound };

type Filter = 'abertas' | 'todas' | Approval['kind'];

export function ApprovalsTab({ selectedId, onSelect, approvedJourneyId, onApprovedPromotion }: {
  selectedId: string | null;
  onSelect: (id: string) => void;
  approvedJourneyId: string | null;
  onApprovedPromotion: (journeyId: string) => void;
}) {
  const ws = useWs();
  const [filter, setFilter] = useState<Filter>('abertas');
  const list = ws.approvals
    .filter((a) => (filter === 'abertas' ? a.status === 'pendente' || a.status === 'ajuste' : filter === 'todas' ? true : a.kind === filter))
    .sort((a, b) => (a.status === 'pendente' ? 0 : 1) - (b.status === 'pendente' ? 0 : 1) || (a.requestedAt < b.requestedAt ? 1 : -1));
  const selected = ws.approvals.find((a) => a.id === selectedId) ?? list[0] ?? null;
  const open = ws.approvals.filter((a) => a.status === 'pendente' || a.status === 'ajuste').length;
  const approvedJourney = approvedJourneyId ? ws.journeys.find((j) => j.id === approvedJourneyId) : undefined;

  return (
    <div className="space-y-4" data-tour="governanca-aprovacoes">
      {approvedJourneyId && (
        <div className="flex flex-wrap items-center gap-3 rounded-card border border-primary/50 bg-primary/5 px-4 py-3 shadow-halo-green">
          <Check className="h-5 w-5 text-primary" />
          <div className="flex-1 text-sm">
            <b className="font-medium">Gate de Prd satisfeito.</b> CoE AI e dono de negócio aprovaram a promoção de “{approvedJourney?.name ?? approvedJourneyId}”.
          </div>
          <Link href={`/jornadas/studio?id=${approvedJourneyId}`} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            Voltar ao Studio <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}
      <Tabs<Filter>
        value={filter}
        onChange={setFilter}
        tabs={[
          { id: 'abertas', label: `Abertas (${open})` },
          { id: 'promocao', label: 'Promoções' },
          { id: 'componente', label: 'Componentes' },
          { id: 'contrato', label: 'Contratos' },
          { id: 'acesso', label: 'Acessos' },
          { id: 'todas', label: 'Todas' },
        ]}
      />
      {list.length === 0 ? (
        <EmptyState icon={Inbox} title="Fila vazia" description="Nenhum pedido neste filtro. Pedidos de componentes, contratos, promoções e acessos chegam aqui." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(280px,380px)_1fr]">
          <div className="space-y-2">
            {list.map((a) => {
              const Icon = KIND_ICON[a.kind];
              return (
                <button
                  key={a.id}
                  onClick={() => onSelect(a.id)}
                  className={cx(
                    'w-full rounded-card border bg-surface-1 p-3 text-left transition-colors hover:border-accent',
                    selected?.id === a.id ? 'border-accent bg-surface-2' : 'border-border',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <Chip tone="muted" icon={Icon}>{KIND_LABEL[a.kind]}</Chip>
                    <StatusChip status={a.status} />
                  </div>
                  <div className="mt-2 text-sm font-medium">{a.title}</div>
                  <div className="mt-1 text-xs text-text-muted">
                    {a.requestedBy} · {fmtDateTime(a.requestedAt)} · decide: {PROFILES[a.approverProfile].label}
                  </div>
                </button>
              );
            })}
          </div>
          {selected && <ApprovalDetail approval={selected} onApprovedPromotion={onApprovedPromotion} />}
        </div>
      )}
    </div>
  );
}

function ApprovalDetail({ approval: a, onApprovedPromotion }: { approval: Approval; onApprovedPromotion: (journeyId: string) => void }) {
  const ws = useWs();
  const profile = useProfile();
  const mutate = useCortex((s) => s.mutate);
  const [comment, setComment] = useState('');
  const [modal, setModal] = useState<null | 'reprovado' | 'ajuste'>(null);
  const [reason, setReason] = useState('');
  const isApprover = profile === a.approverProfile;
  const actionable = a.status === 'pendente' || a.status === 'ajuste';
  const journeyId = a.kind === 'promocao' ? journeyIdFromObject(a.objectId) : null;
  const journey = journeyId ? ws.journeys.find((j) => j.id === journeyId) : undefined;
  const siblings = a.kind === 'promocao' ? ws.approvals.filter((x) => x.kind === 'promocao' && x.objectId === a.objectId && x.id !== a.id) : [];
  const Icon = KIND_ICON[a.kind];

  const decide = (d: Decision, note: string) => {
    const r = decideApproval(a.id, d, note);
    if (!r) return;
    if (d === 'aprovado' && a.kind === 'promocao' && r.journeyId) {
      onApprovedPromotion(r.journeyId);
      if (a.approverProfile === 'dono_negocio') emitTourAction('governanca.aprovar');
    }
  };

  const addComment = () => {
    const text = comment.trim();
    if (!text) return;
    const name = ws.users.find((u) => u.profile === profile)?.name ?? PROFILES[profile].label;
    mutate((d) => {
      const x = d.approvals.find((y) => y.id === a.id);
      if (x) x.comments = [...x.comments, { by: name, at: demoNow(), text }];
    }, { action: 'Comentou pedido de aprovação', object: a.title });
    setComment('');
  };

  const diff = a.diff ? splitDiff(a.diff) : null;

  return (
    <Card>
      <CardHeader icon={Icon} title={a.title} subtitle={`${KIND_LABEL[a.kind]} · pedido por ${a.requestedBy} em ${fmtDateTime(a.requestedAt)}`} actions={<StatusChip status={a.status} />} />
      <div className="space-y-4 p-4">
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-text-muted">
          <span>Objeto: <Mono className="text-text">{a.objectId}</Mono></span>
          <span>Quem decide: <b className="font-medium text-text">{PROFILES[a.approverProfile].label}</b></span>
          {journey && (
            <Link className="text-primary hover:underline" href={`/jornadas/studio?id=${journey.id}`}>Abrir “{journey.name}” no Studio</Link>
          )}
        </div>

        {siblings.length > 0 && (
          <div className="rounded-field border border-border bg-surface-2/50 p-3">
            <div className="mb-2 text-xs font-medium text-text-muted">Gate de Prd: aprovações exigidas</div>
            <div className="flex flex-wrap gap-2">
              {[a, ...siblings].map((x) => (
                <span key={x.id} className="inline-flex items-center gap-2 text-xs">
                  {PROFILES[x.approverProfile].label} <StatusChip status={x.status} />
                </span>
              ))}
            </div>
          </div>
        )}

        {diff ? (
          <div>
            <div className="mb-2 text-xs font-medium text-text-muted">O que muda</div>
            <DiffView before={diff.before} after={diff.after} titleBefore="Hoje" titleAfter="Proposto" />
          </div>
        ) : (
          <p className="text-sm text-text-muted">Pedido sem diff: a decisão se baseia na justificativa e nos comentários.</p>
        )}

        <div>
          <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-text-muted"><MessageSquare className="h-3.5 w-3.5" />Comentários ({a.comments.length})</div>
          <div className="space-y-2">
            {a.comments.length === 0 && <p className="text-xs text-text-muted">Nenhum comentário ainda.</p>}
            {a.comments.map((c, i) => (
              <div key={i} className="rounded-field border border-border bg-surface-2/40 px-3 py-2">
                <div className="text-xs text-text-muted"><b className="font-medium text-text">{c.by}</b> · {fmtDateTime(c.at)}</div>
                <div className="mt-0.5 text-sm">{c.text}</div>
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Escreva um comentário" className="min-h-[40px]" />
            <Button variant="tertiary" size="sm" icon={Send} disabled={!comment.trim()} onClick={addComment} className="self-end">Comentar</Button>
          </div>
        </div>

        {actionable && (isApprover ? (
          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            <Button variant="primary" icon={Check} onClick={() => decide('aprovado', '')}>Aprovar</Button>
            <Button variant="tertiary" icon={FileEdit} onClick={() => { setReason(''); setModal('ajuste'); }}>Pedir ajuste</Button>
            <Button variant="danger" icon={X} onClick={() => { setReason(''); setModal('reprovado'); }}>Reprovar com motivo</Button>
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded-card border border-warning/40 bg-warning/5 p-4">
            <Lock className="mt-0.5 h-5 w-5 shrink-0 text-warning" strokeWidth={1.5} />
            <div className="text-sm">
              <div className="font-semibold">Somente {PROFILES[a.approverProfile].label} decide este pedido</div>
              <p className="mt-0.5 text-text-muted">
                Você está como {PROFILES[profile].label}. Use “Ver como” no cabeçalho para entrar com o perfil de {PROFILES[a.approverProfile].label.toLowerCase()} ({PROFILES[a.approverProfile].who}).
              </p>
            </div>
          </div>
        ))}
      </div>

      <Modal
        open={modal !== null}
        onClose={() => setModal(null)}
        title={modal === 'reprovado' ? 'Reprovar pedido' : 'Pedir ajuste'}
        subtitle={a.title}
        footer={
          <>
            <Button variant="tertiary" size="sm" onClick={() => setModal(null)}>Cancelar</Button>
            <Button
              variant={modal === 'reprovado' ? 'danger' : 'secondary'}
              size="sm"
              disabled={reason.trim().length < 5}
              onClick={() => { if (modal) decide(modal, reason); setModal(null); }}
            >
              {modal === 'reprovado' ? 'Confirmar reprovação' : 'Enviar pedido de ajuste'}
            </Button>
          </>
        }
      >
        <Field label={modal === 'reprovado' ? 'Motivo (obrigatório, fica na auditoria)' : 'O que precisa mudar'}>
          <Textarea autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder={modal === 'reprovado' ? 'Ex.: faltam casos de teste para entradas ambíguas' : 'Ex.: incluir o caso de cliente sem consentimento'} />
        </Field>
      </Modal>
    </Card>
  );
}
