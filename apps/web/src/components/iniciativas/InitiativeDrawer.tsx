'use client';

import { BrainCircuit, Check, CheckCircle2, Info, RotateCcw, ThumbsUp, Workflow } from 'lucide-react';
import type { EnvId, Initiative, WorkspaceData } from '@cortex/schemas';
import { ENV_ORDER, INITIATIVE_STAGES } from '@cortex/schemas';
import { formatBRL } from '@cortex/engine';
import { Button, Chip, Drawer, EnvBadge, Mono, StatusChip, cx } from '@/components/ui';
import { ValidationReport } from './ValidationReport';
import { ConversationPrototype } from './ConversationPrototype';
import { HEALTH, STAGE_INFO, STAGE_LABEL, TYPE_LABEL, domainName, stageIndex } from './shared';

export interface RevealState {
  id: string;
  count: number;
  running: boolean;
}

export function InitiativeDrawer({ ws, ini, env, reveal, canDecide, busy, onClose, onValidate, onSeguir, onRever, onGerar }: {
  ws: WorkspaceData;
  ini: Initiative | null;
  env: EnvId;
  reveal: RevealState | null;
  canDecide: boolean;
  busy: string | null;
  onClose: () => void;
  onValidate: () => void;
  onSeguir: () => void;
  onRever: () => void;
  onGerar: () => void;
}) {
  if (!ini) return null;
  const idx = stageIndex(ini.stage);
  const journey = ws.journeys.find((j) => j.id === ini.journeyId);
  const v = ini.validation;
  const animating = reveal?.id === ini.id;
  const showReport = !!v && (animating || idx >= 1);
  const revealed = animating ? reveal!.count : v?.checks.length ?? 0;
  const reportDone = showReport && !(animating && reveal!.running);
  const decision = v?.decision;
  const canGenerate = decision === 'seguir' || idx >= 2;

  return (
    <Drawer
      open
      onClose={onClose}
      width={640}
      title={ini.title}
      subtitle={
        <span className="mt-1 flex flex-wrap items-center gap-1.5">
          <Chip tone="muted">{STAGE_LABEL[ini.stage]}</Chip>
          <Chip tone="purple">{TYPE_LABEL[ini.type]}</Chip>
          <StatusChip status={HEALTH[ini.health].status} label={HEALTH[ini.health].label} />
        </span>
      }
    >
      <div className="space-y-6">
        {/* Resumo */}
        <section className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div className="col-span-2">
            <div className="text-xs text-text-muted">Problema</div>
            <p>{ini.problem}</p>
          </div>
          <div className="col-span-2">
            <div className="text-xs text-text-muted">Objetivo</div>
            <p>{ini.objective}</p>
          </div>
          <div>
            <div className="text-xs text-text-muted">Métrica de valor</div>
            <p>{ini.metric}</p>
          </div>
          <div>
            <div className="text-xs text-text-muted">Valor esperado</div>
            <p className="text-xl font-semibold text-primary">{ini.expectedValueBRL ? formatBRL(ini.expectedValueBRL).replace(',00', '') : '—'}</p>
          </div>
          <div>
            <div className="text-xs text-text-muted">Domínio</div>
            <p>{domainName(ws, ini.domainId)}</p>
          </div>
          <div>
            <div className="text-xs text-text-muted">Dono</div>
            <p>{ini.owner}</p>
          </div>
        </section>

        {/* Linha do tempo dos estágios */}
        <section>
          <h3 className="mb-2 text-sm font-semibold">Estágios</h3>
          <ol className="flex items-center gap-1">
            {INITIATIVE_STAGES.map((s, i) => (
              <li key={s.id} className="flex flex-1 items-center gap-1">
                <div
                  className={cx(
                    'flex w-full flex-col items-center gap-1 rounded-field border px-1 py-2 text-center text-xs transition-all duration-200',
                    i < idx && 'border-primary/40 text-text',
                    i === idx && 'border-primary/60 shadow-halo-green text-text',
                    i > idx && 'border-border text-text-muted',
                  )}
                >
                  <span className={cx('flex h-5 w-5 items-center justify-center rounded-full border text-[11px]', i <= idx ? 'border-primary text-primary' : 'border-border')}>
                    {i < idx ? <Check className="h-3 w-3" strokeWidth={2} /> : i + 1}
                  </span>
                  {s.label}
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-field border border-border bg-surface-2 p-2">
              <div className="text-text-muted">O super harness entrega</div>
              <div className="mt-0.5">{STAGE_INFO[ini.stage].delivers}</div>
            </div>
            <div className="rounded-field border border-border bg-surface-2 p-2">
              <div className="text-text-muted">Decisão humana</div>
              <div className="mt-0.5">{STAGE_INFO[ini.stage].decision}</div>
            </div>
          </div>
        </section>

        {/* Jornada ligada */}
        <section>
          <h3 className="mb-2 text-sm font-semibold">Jornada ligada</h3>
          {journey ? (
            <div className="rounded-field border border-border bg-surface-2 p-3 text-sm">
              <div className="flex items-center gap-2 font-medium">
                <Workflow className="h-4 w-4 text-primary" strokeWidth={1.5} /> {journey.name}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {ENV_ORDER.map((e) => (
                  <span key={e} className={cx('inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs', e === env ? 'border-accent/60' : 'border-border')}>
                    <EnvBadge env={e} />
                    {journey.envVersions[e] ? <Mono>v{journey.envVersions[e]}</Mono> : <span className="text-text-muted">ausente</span>}
                  </span>
                ))}
              </div>
              {idx < 3 && <p className="mt-2 text-xs text-text-muted">A jornada é desenhada no Studio quando a iniciativa chega à construção.</p>}
            </div>
          ) : (
            <p className="text-sm text-text-muted">Ainda sem jornada. Ela nasce do botão &quot;Gerar jornada&quot;, depois da decisão do patrocinador.</p>
          )}
        </section>

        {/* Validação */}
        <section>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Relatório de validação</h3>
            <span data-tour="iniciativa-validar" className="inline-flex rounded-full">
              <Button
                size="sm"
                variant={showReport ? 'tertiary' : 'primary'}
                icon={BrainCircuit}
                onClick={onValidate}
                loading={busy === 'validar'}
                disabled={!!busy}
              >
                {showReport ? 'Validar de novo' : 'Validar no cérebro'}
              </Button>
            </span>
          </div>
          {showReport && v ? (
            <div data-tour="validacao-relatorio" className="rounded-card">
              <ValidationReport validation={v} revealed={revealed} running={!!animating && reveal!.running} />
            </div>
          ) : (
            <div className="flex items-start gap-2 rounded-field border border-dashed border-border p-3 text-sm text-text-muted">
              <Info className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.5} />
              O cérebro roda oito checagens (estratégia, mercado e regulação, regras, dados, integrações, arquitetura, reuso e business case), cada uma com a fonte consultada.
            </div>
          )}
        </section>

        {/* Decisão do patrocinador e protótipo */}
        {reportDone && (
          <section data-tour="validacao-seguir" className="animate-fade-in space-y-3 rounded-card">
            <h3 className="text-sm font-semibold">Decisão do patrocinador</h3>
            {!canDecide && !decision && (
              <div className="flex items-start gap-2 rounded-field border border-warning/40 bg-warning/5 p-3 text-sm">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-warning" strokeWidth={1.5} />
                <span>A decisão de seguir é do Patrocinador executivo. Neste perfil, a demo registra a decisão do patrocinador de forma simulada, com confirmação.</span>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {decision === 'seguir' ? (
                <Chip tone="green" icon={CheckCircle2}>Decisão registrada: seguir</Chip>
              ) : (
                <>
                  <Button variant="primary" icon={ThumbsUp} onClick={onSeguir} disabled={!!busy} loading={busy === 'seguir'}>Seguir</Button>
                  <Button variant="tertiary" icon={RotateCcw} onClick={onRever} disabled={!!busy}>Rever</Button>
                  {decision === 'rever' && <Chip tone="yellow" icon={RotateCcw}>Decisão registrada: rever</Chip>}
                </>
              )}
            </div>
            {decision === 'seguir' && <ConversationPrototype journey={journey} company={ws.workspace.company} />}
          </section>
        )}

        {canGenerate && (
          <section className="flex items-center justify-between gap-3 rounded-card border border-border bg-surface-2 p-3">
            <div className="text-sm">
              <div className="font-medium">{idx >= 3 && journey ? 'Jornada em construção' : 'Próximo passo: a jornada'}</div>
              <div className="text-xs text-text-muted">
                {idx >= 3 && journey ? 'Abra o rascunho no Studio para testar e promover.' : 'Gera o rascunho da jornada no Studio a partir da iniciativa validada, com os componentes do cérebro.'}
              </div>
            </div>
            <span data-tour="gerar-jornada" className="inline-flex rounded-full">
              <Button variant="primary" icon={Workflow} onClick={onGerar} disabled={!!busy && busy !== 'gerar'} loading={busy === 'gerar'}>
                {idx >= 3 && journey ? 'Abrir no Studio' : 'Gerar jornada'}
              </Button>
            </span>
          </section>
        )}
      </div>
    </Drawer>
  );
}
