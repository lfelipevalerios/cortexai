'use client';

// Inspetor à direita (400 px): configuração do nó, problemas e execução do último teste.
import { useMemo, useState } from 'react';
import { X, Wand2, Plus, Trash2 } from 'lucide-react';
import { NODE_CATEGORIES, type JourneyNode, type TraceStep, type WorkspaceData } from '@cortex/schemas';
import { formatNumber, type GraphProblem } from '@cortex/engine';
import { brl4 } from './lib';
import { Button, Chip, Field, Input, Select, StatusChip, Tabs, cx } from '@/components/ui';
import { iconForKind, kindLabel } from './icons';

type Tab = 'config' | 'problemas' | 'execucao';

export function Inspector({
  node, data, editable, problems, lastStep, suggestions, onChange, onClose, onFix, onAddNext, onRemove,
}: {
  node: JourneyNode;
  data: WorkspaceData;
  editable: boolean;
  problems: GraphProblem[];
  lastStep?: TraceStep;
  suggestions: string[];
  onChange: (patch: Partial<JourneyNode>) => void;
  onClose: () => void;
  onFix: (p: GraphProblem) => void;
  onAddNext: (kind: string) => void;
  onRemove: () => void;
}) {
  const [tab, setTab] = useState<Tab>('config');
  const Icon = iconForKind(node.kind);
  const cat = NODE_CATEGORIES[node.category];

  const componentOptions = useMemo(
    () => [
      { value: '', label: 'Nenhum componente' },
      ...data.components
        .filter((c) => c.type !== 'pacote' && c.type !== 'documento')
        .map((c) => ({ value: c.id, label: `${c.name} · v${c.version} (${c.status.replace('_', ' ')})` })),
    ],
    [data.components],
  );
  const ruleOptions = useMemo(
    () => [
      { value: '', label: 'Nenhuma regra' },
      ...data.decisionTables.map((t) => ({ value: t.id, label: `Tabela: ${t.name} v${t.version}` })),
      ...data.components.filter((c) => c.type === 'rule').map((c) => ({ value: c.id, label: `Rule: ${c.name} v${c.version}` })),
    ],
    [data.decisionTables, data.components],
  );
  const contractOptions = useMemo(
    () => [{ value: '', label: 'Nenhum contrato' }, ...data.contracts.map((c) => ({ value: c.id, label: `${c.name} (${c.status})` }))],
    [data.contracts],
  );
  const toolOptions = useMemo(
    () => [
      { value: '', label: 'Nenhuma tool' },
      ...data.connectors.flatMap((c) => c.tools.map((t) => ({ value: t.id, label: `${c.name} · ${t.name} (${t.mode})` }))),
    ],
    [data.connectors],
  );
  const channelOptions = useMemo(
    () => [{ value: '', label: 'Nenhum canal' }, ...data.channels.map((c) => ({ value: c.id, label: c.name }))],
    [data.channels],
  );
  const comp = node.componentId ? data.components.find((c) => c.id === node.componentId) : undefined;

  return (
    <aside aria-label="Inspetor do nó" className="flex w-[400px] shrink-0 flex-col border-l border-border bg-surface-1">
      <div className="flex items-start gap-3 border-b border-border px-4 py-3">
        <span
          className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border"
          style={{ color: cat.color, borderColor: `${cat.color}66`, background: `${cat.color}14` }}
        >
          <Icon className="h-4 w-4" strokeWidth={1.5} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{node.label}</div>
          <div className="truncate text-xs text-text-muted">
            {cat.label} · {kindLabel(node.kind)} · <span className="font-mono">{node.id}</span>
          </div>
        </div>
        <button onClick={onClose} aria-label="Fechar inspetor" className="rounded-full p-1.5 text-text-muted hover:bg-surface-2 hover:text-text">
          <X className="h-4 w-4" />
        </button>
      </div>
      <Tabs<Tab>
        className="px-3"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'config', label: 'Configuração' },
          { id: 'problemas', label: `Problemas${problems.length ? ` (${problems.length})` : ''}` },
          { id: 'execucao', label: 'Último teste' },
        ]}
      />
      <div className="min-h-0 flex-1 space-y-3 overflow-auto px-4 py-3">
        {tab === 'config' && (
          <>
            <Field label="Nome da etapa">
              <Input value={node.label} disabled={!editable} onChange={(e) => onChange({ label: e.target.value })} />
            </Field>
            <Field
              label="Componente do catálogo"
              hint={comp ? <span>Versão fixada <span className="font-mono">v{node.componentVersion ?? comp.version}</span> · <StatusChip status={comp.status} /></span> : 'Agentes, skills, rules e hooks homologados do catálogo.'}
            >
              <Select
                options={componentOptions}
                value={node.componentId ?? ''}
                disabled={!editable}
                onChange={(e) => {
                  const c = data.components.find((x) => x.id === e.target.value);
                  onChange({ componentId: c?.id, componentVersion: c?.version });
                }}
              />
            </Field>
            <Field label="Regra do cérebro">
              <Select options={ruleOptions} value={node.ruleId ?? ''} disabled={!editable} onChange={(e) => onChange({ ruleId: e.target.value || undefined })} />
            </Field>
            <Field label="Contrato de dados">
              <Select options={contractOptions} value={node.contractId ?? ''} disabled={!editable} onChange={(e) => onChange({ contractId: e.target.value || undefined })} />
            </Field>
            <Field label="Tool do conector">
              <Select options={toolOptions} value={node.toolId ?? ''} disabled={!editable} onChange={(e) => onChange({ toolId: e.target.value || undefined })} />
            </Field>
            <Field label="Canal">
              <Select options={channelOptions} value={node.channelId ?? ''} disabled={!editable} onChange={(e) => onChange({ channelId: e.target.value || undefined })} />
            </Field>
            {node.emitsPii && (
              <Chip tone="yellow">Saída contém dado pessoal (PII)</Chip>
            )}
            {node.outputs?.length ? (
              <div className="text-xs text-text-muted">
                Saídas nomeadas: {node.outputs.map((o) => <Chip key={o} tone="muted" className="ml-1">{o}</Chip>)}
              </div>
            ) : null}
            {editable && suggestions.length > 0 && (
              <div className="rounded-field border border-border bg-surface-2/50 p-3">
                <div className="mb-2 text-xs font-medium text-text-muted">Próximo nó sugerido</div>
                <div className="flex flex-wrap gap-1.5">
                  {suggestions.slice(0, 3).map((k) => (
                    <Button key={k} size="sm" variant="tertiary" icon={Plus} onClick={() => onAddNext(k)}>
                      {kindLabel(k)}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            {editable && (
              <Button size="sm" variant="ghost" icon={Trash2} onClick={onRemove} className="text-danger">
                Remover nó
              </Button>
            )}
          </>
        )}

        {tab === 'problemas' &&
          (problems.length === 0 ? (
            <p className="text-sm text-text-muted">Nenhum problema neste nó.</p>
          ) : (
            <ul className="space-y-2">
              {problems.map((p) => (
                <li key={p.id} className={cx('rounded-field border p-3', p.severity === 'erro' ? 'border-danger/40 bg-danger/5' : 'border-warning/40 bg-warning/5')}>
                  <StatusChip status={p.severity === 'erro' ? 'erro' : 'amarelo'} label={p.severity === 'erro' ? 'Erro' : 'Aviso'} />
                  <p className="mt-1.5 text-sm">{p.message}</p>
                  {p.fix && (
                    <Button size="sm" variant="primary" icon={Wand2} className="mt-2" disabled={!editable} onClick={() => onFix(p)}>
                      {p.fix.label}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          ))}

        {tab === 'execucao' &&
          (lastStep ? (
            <StepDetail step={lastStep} />
          ) : (
            <p className="text-sm text-text-muted">Este nó ainda não foi executado. Rode “Testar com persona” para ver entrada, saída, regra e custo.</p>
          ))}
      </div>
    </aside>
  );
}

export function StepDetail({ step }: { step: TraceStep }) {
  const status = step.status === 'ok' ? 'ok' : step.status === 'alerta' ? 'amarelo' : step.status === 'bloqueado' ? 'bloqueado' : 'erro';
  const label = step.status === 'alerta' ? 'Alerta (mascarado)' : undefined;
  return (
    <div className="space-y-2 text-sm">
      <StatusChip status={status} label={label} />
      <Row k="Entrada" v={step.input} />
      <Row k="Saída" v={step.output} />
      {step.rule && <Row k="Regra aplicada" v={step.rule} />}
      {step.source && <Row k="Fonte" v={step.source} />}
      <div className="flex flex-wrap gap-3 pt-1 font-mono text-xs text-text-muted">
        <span>{formatNumber(step.tokens)} tokens</span>
        <span>{formatNumber(step.latencyMs)} ms</span>
        <span>{brl4(step.costBRL)}</span>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-text-muted">{k}</div>
      <div className="mt-0.5 break-words">{v}</div>
    </div>
  );
}
