'use client';

// Modal de promoção: gates do motor como checklist que se preenche um a um.
// Dev → Hml exige o Champion AI; Hml → Prd exige CoE AI e dono de negócio.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Clock, Loader2, LocateFixed, Lock, Rocket, XCircle } from 'lucide-react';
import type { Approval, EnvId, Journey } from '@cortex/schemas';
import { canPromote, evaluateGates, type Gate } from '@cortex/engine';
import { Button, EnvBadge, Modal, Mono, cx } from '@/components/ui';
import { cortex, demoNow, useCortex, useProfile, useWs } from '@/lib/store';
import { sleep } from '@/lib/tour-bus';
import { nextApprovalId, nextReleaseId, prdObjectId, prefixOf, userName } from './lib';

export type PromotionResult = 'promovida' | 'bloqueada' | 'cancelada';
type Phase = 'checking' | 'review' | 'working' | 'promovida' | 'bloqueada';

const GATE_MS = 400;

function approvalsFor(approvals: Approval[], objectId: string) {
  const mine = approvals.filter((a) => a.kind === 'promocao' && a.objectId === objectId);
  return {
    exists: mine.length > 0,
    coe: mine.some((a) => a.approverProfile === 'coe' && a.status === 'aprovado'),
    owner: mine.some((a) => a.approverProfile === 'dono_negocio' && a.status === 'aprovado'),
  };
}

export function PromotionModal({
  journey, to, auto, onClose, onGoTo, onFinished,
}: {
  journey: Journey;
  to: 'hml' | 'prd';
  auto: boolean;
  onClose: () => void;
  onGoTo: (nodeId: string) => void;
  onFinished: (r: PromotionResult) => void;
}) {
  const ws = useWs();
  const profile = useProfile();
  const mutate = useCortex((s) => s.mutate);
  const toast = useCortex((s) => s.toast);
  const from: EnvId = to === 'hml' ? 'dev' : 'hml';
  const versionId = journey.envVersions[from];
  const version = journey.versions.find((v) => v.version === versionId);
  const objectId = versionId ? prdObjectId(journey.id, versionId) : '';
  const appr = approvalsFor(ws.approvals, objectId);

  const [phase, setPhase] = useState<Phase>('checking');
  const [revealed, setRevealed] = useState(0);
  const [championOk, setChampionOk] = useState(false);
  const [traffic, setTraffic] = useState(100);
  const [run, setRun] = useState(0);
  const finished = useRef(false);

  const gates: Gate[] = useMemo(
    () =>
      version
        ? evaluateGates({ journey, version, from, to, data: ws, approvals: { champion: championOk, coe: appr.coe, owner: appr.owner } })
        : [],
    [journey, version, from, to, ws, championOk, appr.coe, appr.owner],
  );
  const gatesRef = useRef(gates);
  gatesRef.current = gates;

  // Preenche o checklist um gate por vez.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setRevealed(0);
      const n = gatesRef.current.length;
      for (let i = 0; i < n; i++) {
        await sleep(GATE_MS);
        if (cancelled) return;
        setRevealed(i + 1);
      }
      if (!cancelled) setPhase((p) => (p === 'checking' ? 'review' : p));
    })();
    return () => {
      cancelled = true;
    };
  }, [run]);

  const finish = useCallback(
    (r: PromotionResult) => {
      if (finished.current) return;
      finished.current = true;
      onFinished(r);
    },
    [onFinished],
  );

  const isChampion = profile === 'champion';
  const pendingChampion = to === 'hml' && !championOk;
  const otherFailed = gates.filter((g) => !g.passed && !(g.id === 'aprovacao_champion' && isChampion));

  const promoteHml = async () => {
    if (!version || !isChampion) {
      setPhase('bloqueada');
      finish('bloqueada');
      return;
    }
    setPhase('working');
    setChampionOk(true);
    await sleep(GATE_MS + 100);
    const data = cortex.ws()!;
    const j = data.journeys.find((x) => x.id === journey.id)!;
    const v = j.versions.find((x) => x.version === j.envVersions.dev)!;
    const fresh = evaluateGates({ journey: j, version: v, from: 'dev', to: 'hml', data, approvals: { champion: true } });
    if (!canPromote(fresh)) {
      setPhase('bloqueada');
      finish('bloqueada');
      return;
    }
    const p = prefixOf(j.id);
    mutate(
      (d) => {
        const jj = d.journeys.find((x) => x.id === j.id)!;
        jj.envVersions.hml = v.version;
        d.releases.unshift({ id: nextReleaseId(d, p), journeyId: j.id, from: 'dev', to: 'hml', version: v.version, at: demoNow(), by: userName(d, profile), status: 'promovida' });
      },
      { action: 'Promoveu jornada para Hml', object: `${j.name} ${v.version}` },
    );
    setPhase('promovida');
    toast({ kind: 'sucesso', title: `Promovida para Hml: v${v.version}`, description: 'Todos os gates passaram. A versão já pode ser plugada nos canais de Hml.' });
    finish('promovida');
  };

  const attemptPrd = async () => {
    if (!versionId) {
      finish('bloqueada');
      return;
    }
    setPhase('working');
    const p = prefixOf(journey.id);
    let data = cortex.ws()!;
    if (!approvalsFor(data.approvals, objectId).exists) {
      const by = userName(data, profile);
      const coeName = userName(data, 'coe');
      mutate(
        (d) => {
          const title = `Promover "${journey.name}" ${versionId} para Prd`;
          const base = { kind: 'promocao' as const, title, requestedBy: by, requestedAt: demoNow(), objectId, diff: `+ versão ${versionId} vinda de Hml\n= contratos compatíveis\n= suíte de testes passando` };
          const idCoe = nextApprovalId(d, p);
          d.approvals.unshift({ ...base, id: idCoe, status: 'aprovado', approverProfile: 'coe', comments: [{ by: coeName, at: demoNow(), text: 'Gates técnicos atendidos. De acordo do CoE AI.' }] });
          d.approvals.unshift({ ...base, id: nextApprovalId(d, p), status: 'pendente', approverProfile: 'dono_negocio', comments: [] });
        },
        { action: 'Solicitou promoção para Prd', object: `${journey.name} ${versionId}` },
      );
      // Reexecuta o checklist com as aprovações registradas.
      setRun((r) => r + 1);
      await sleep(GATE_MS * (gatesRef.current.length + 1) + 150);
    }
    data = cortex.ws()!;
    const j = data.journeys.find((x) => x.id === journey.id)!;
    const v = j.versions.find((x) => x.version === versionId)!;
    const a = approvalsFor(data.approvals, objectId);
    const fresh = evaluateGates({ journey: j, version: v, from: 'hml', to: 'prd', data, approvals: { coe: a.coe, owner: a.owner } });
    if (canPromote(fresh)) {
      mutate(
        (d) => {
          const jj = d.journeys.find((x) => x.id === j.id)!;
          jj.envVersions.prd = versionId;
          d.releases.unshift({ id: nextReleaseId(d, p), journeyId: j.id, from: 'hml', to: 'prd', version: versionId, at: demoNow(), by: userName(d, profile), status: 'promovida', trafficPct: traffic });
        },
        { action: 'Promoveu jornada para Prd', object: `${j.name} ${versionId} (${traffic}% do tráfego)` },
      );
      setPhase('promovida');
      toast({ kind: 'sucesso', title: `Promovida para Prd: v${versionId}`, description: traffic < 100 ? `Liberação gradual: ${traffic}% do tráfego do canal.` : 'Todo o tráfego do canal passa para a nova versão.' });
      finish('promovida');
      return;
    }
    const already = data.releases.some((r) => r.journeyId === j.id && r.to === 'prd' && r.version === versionId && r.status === 'bloqueada');
    if (!already) {
      mutate(
        (d) => {
          d.releases.unshift({ id: nextReleaseId(d, p), journeyId: j.id, from: 'hml', to: 'prd', version: versionId, at: demoNow(), by: userName(d, profile), status: 'bloqueada' });
        },
        { action: 'Promoção para Prd bloqueada por gate', object: `${j.name} ${versionId}` },
      );
    }
    setPhase('bloqueada');
    const first = fresh.find((g) => !g.passed);
    toast({ kind: 'aviso', title: 'Promoção para Prd bloqueada', description: first?.reason ?? 'Há gates pendentes.' });
    finish('bloqueada');
  };

  const confirm = to === 'hml' ? promoteHml : attemptPrd;
  const confirmRef = useRef(confirm);
  confirmRef.current = confirm;

  // Piloto automático: confirma ao terminar o checklist.
  const autoFired = useRef(false);
  useEffect(() => {
    if (auto && phase === 'review' && !finished.current && !autoFired.current) {
      const t = setTimeout(() => {
        autoFired.current = true;
        void confirmRef.current();
      }, 500);
      return () => clearTimeout(t);
    }
  }, [auto, phase]);

  const close = () => {
    finish('cancelada');
    onClose();
  };

  const allRevealed = revealed >= gates.length;
  const canConfirm =
    !!version && (to === 'hml' ? phase === 'review' && isChampion && otherFailed.length === 0 : phase === 'review' || phase === 'bloqueada');
  const ownerPending = to === 'prd' && appr.exists && !appr.owner;

  const footer =
    phase === 'promovida' ? (
      <Button variant="primary" onClick={onClose}>Concluir</Button>
    ) : (
      <>
        <Button variant="ghost" onClick={close}>Fechar</Button>
        {to === 'hml' ? (
          <Button variant="primary" icon={Rocket} disabled={!canConfirm} loading={phase === 'working'} onClick={() => void confirm()}>
            {isChampion ? 'Aprovar como Champion AI e promover' : 'Aguardando o Champion AI'}
          </Button>
        ) : (
          <Button variant="primary" icon={Rocket} disabled={!canConfirm} loading={phase === 'working'} onClick={() => void confirm()}>
            {appr.exists ? (canPromote(gates) ? 'Promover para Prd' : 'Tentar de novo') : 'Solicitar aprovações e promover'}
          </Button>
        )}
      </>
    );

  return (
    <Modal
      open
      onClose={close}
      width={620}
      title={
        <span className="flex items-center gap-2">
          Promover <EnvBadge env={from} /> <ArrowRight className="h-4 w-4 text-text-muted" /> <EnvBadge env={to} />
        </span>
      }
      subtitle={
        <span>
          {journey.name} · <Mono>v{versionId ?? '—'}</Mono>
        </span>
      }
      footer={footer}
    >
      {!version ? (
        <p className="text-sm text-text-muted">Não há versão em {from === 'dev' ? 'Dev' : 'Hml'} para promover.</p>
      ) : (
        <div data-tour={to === 'prd' ? 'promocao-prd' : undefined} className="space-y-3">
          <ol data-tour="promocao-gates" className="space-y-1.5" aria-live="polite">
            {gates.map((g, i) => {
              const shown = i < revealed;
              const checking = (phase === 'checking' || phase === 'working') && i === revealed;
              const champWait = g.id === 'aprovacao_champion' && !g.passed && isChampion;
              const state = !shown ? (checking ? 'checking' : 'waiting') : g.passed ? 'ok' : champWait ? 'pending' : 'fail';
              return (
                <li
                  key={g.id}
                  className={cx(
                    'rounded-field border px-3 py-2 transition-colors duration-200',
                    state === 'ok' && 'border-primary/40 bg-primary/5',
                    state === 'fail' && 'border-danger/50 bg-danger/5',
                    state === 'pending' && 'border-warning/50 bg-warning/5',
                    (state === 'waiting' || state === 'checking') && 'border-border',
                  )}
                >
                  <div className="flex items-center gap-2 text-sm">
                    {state === 'ok' && <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden />}
                    {state === 'fail' && <XCircle className="h-4 w-4 text-danger" aria-hidden />}
                    {state === 'pending' && <Clock className="h-4 w-4 text-warning" aria-hidden />}
                    {state === 'checking' && <Loader2 className="h-4 w-4 animate-spin text-accent" aria-hidden />}
                    {state === 'waiting' && <Clock className="h-4 w-4 text-text-muted" aria-hidden />}
                    <span className={cx('flex-1', state === 'waiting' && 'text-text-muted')}>{g.label}</span>
                    <span className="text-xs text-text-muted">
                      {state === 'ok' ? 'Passou' : state === 'fail' ? (g.approver ? 'Pendente' : 'Reprovado') : state === 'pending' ? 'Aguardando sua aprovação' : state === 'checking' ? 'Checando…' : 'Na fila'}
                    </span>
                  </div>
                  {state === 'fail' && g.reason && (
                    <div className="mt-1 flex flex-wrap items-center justify-between gap-2 pl-6 text-xs">
                      <span className="text-danger">{g.reason}</span>
                      {g.nodeId && (
                        <Button size="sm" variant="tertiary" icon={LocateFixed} onClick={() => { close(); onGoTo(g.nodeId!); }}>
                          Ir ao ponto
                        </Button>
                      )}
                      {g.approver === 'dono_negocio' && appr.exists && (
                        <Link href="/governanca" className="text-accent underline-offset-2 hover:underline">
                          Abrir em Governança
                        </Link>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>

          {allRevealed && to === 'hml' && !isChampion && phase !== 'promovida' && (
            <p className="flex items-center gap-2 text-xs text-warning"><Lock className="h-3.5 w-3.5" /> Somente o Champion AI aprova a ida para Hml. Troque o perfil em “Ver como”.</p>
          )}

          {to === 'prd' && phase === 'review' && canPromote(gates) && (
            <label className="block rounded-field border border-border p-3 text-xs">
              <span className="mb-1 flex justify-between font-medium">
                Liberação gradual <span className="font-mono text-primary">{traffic}% do tráfego</span>
              </span>
              <input type="range" min={10} max={100} step={10} value={traffic} onChange={(e) => setTraffic(Number(e.target.value))} className="w-full accent-[#00FF95]" aria-label="Percentual do tráfego para a nova versão" />
            </label>
          )}

          {phase === 'bloqueada' && to === 'prd' && (
            <div className="flex items-start gap-2 rounded-field border border-danger/50 bg-danger/10 p-3 text-sm">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
              <div>
                <b className="font-medium">Promoção bloqueada.</b>{' '}
                {ownerPending ? 'A aprovação do dono de negócio está pendente na fila de Governança.' : 'Há gates reprovados; corrija e tente de novo.'}
                {ownerPending && (
                  <Link href="/governanca" className="ml-1 text-accent hover:underline">Ir para Governança</Link>
                )}
              </div>
            </div>
          )}

          {phase === 'promovida' && (
            <div className="flex items-center gap-3 rounded-field border border-primary/50 bg-primary/10 p-3 text-sm shadow-halo-green">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              <span className="flex-1">Versão <Mono>v{versionId}</Mono> promovida.</span>
              <span className="flex items-center gap-1.5">
                <EnvBadge env={from} className="opacity-50" /> <ArrowRight className="h-3.5 w-3.5" /> <EnvBadge env={to} className="animate-fade-in shadow-halo-green" />
              </span>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
