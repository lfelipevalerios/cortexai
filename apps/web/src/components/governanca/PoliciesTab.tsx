'use client';

import { useMemo, useState } from 'react';
import { Plus, Trash2, Workflow, GitPullRequestArrow, Hammer, Activity, Code2, SlidersHorizontal, ShieldCheck } from 'lucide-react';
import { ENV_ORDER, ENVS, type EnvId, type Policy } from '@cortex/schemas';
import { useCortex, useWs } from '@/lib/store';
import {
  Button, Card, Chip, EnvBadge, EmptyState, Field, Input, Select, Textarea, Drawer, NoPermission, useCan, cx, Tabs,
} from '@/components/ui';
import { EFFECT_META, KIND_LABEL, PREFIX } from './shared';
import { FIELDS, OPS, codeToRows, describeCode, newRowId, policyReach, rowsToCode, type CondRow } from './policy-code';

type KindFilter = 'todas' | Policy['kind'];

export function PoliciesTab() {
  const ws = useWs();
  const canEdit = useCan('editar_politica');
  const mutate = useCortex((s) => s.mutate);
  const replace = useCortex((s) => s.replaceWorkspace);
  const toast = useCortex((s) => s.toast);
  const [kind, setKind] = useState<KindFilter>('todas');
  const [editing, setEditing] = useState<Policy | null>(null);

  const list = ws.policies.filter((p) => kind === 'todas' || p.kind === kind);
  const counts = useMemo(() => {
    const c: Record<string, number> = { todas: ws.policies.length, stack: 0, jornada: 0, dado: 0 };
    ws.policies.forEach((p) => c[p.kind]++);
    return c;
  }, [ws.policies]);

  const toggle = (p: Policy) => {
    const before = mutate((d) => {
      const x = d.policies.find((y) => y.id === p.id);
      if (x) x.active = !x.active;
    }, { action: p.active ? 'Desativou política' : 'Ativou política', object: p.name });
    toast({
      kind: p.active ? 'aviso' : 'sucesso',
      title: p.active ? `Política desativada: ${p.name}` : `Política ativada: ${p.name}`,
      description: p.active ? 'Ela deixa de valer no desenho, na promoção, na construção e na execução.' : 'Ela passa a valer em todos os pontos de aplicação.',
      undo: before ? () => replace(before) : undefined,
    });
  };

  const newPolicy = () => {
    const p = PREFIX[ws.workspace.industry];
    setEditing({
      id: `${p}-pol-nova-${Date.now().toString(36)}`,
      name: '',
      kind: kind === 'todas' ? 'jornada' : kind,
      description: '',
      condition: '',
      effect: 'alertar',
      envs: ['dev', 'hml', 'prd'],
      active: true,
      code: JSON.stringify({ when: { env: 'prd' }, then: 'alertar' }, null, 2),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs<KindFilter>
          value={kind}
          onChange={setKind}
          tabs={[
            { id: 'todas', label: `Todas (${counts.todas})` },
            { id: 'stack', label: `Stack (${counts.stack})` },
            { id: 'jornada', label: `Jornada (${counts.jornada})` },
            { id: 'dado', label: `Dado (${counts.dado})` },
          ]}
        />
        {canEdit && <Button variant="primary" size="sm" icon={Plus} onClick={newPolicy}>Nova política</Button>}
      </div>
      {!canEdit && <NoPermission action="editar_politica" />}
      {list.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="Nenhuma política deste tipo" description="Crie uma política para governar o desenho, a promoção, a construção e a execução das jornadas." />
      ) : (
        <div className="grid gap-3">
          {list.map((p) => (
            <PolicyRow key={p.id} policy={p} canEdit={canEdit} onToggle={() => toggle(p)} onOpen={() => setEditing(p)} />
          ))}
        </div>
      )}
      {editing && <PolicyEditor policy={editing} canEdit={canEdit} onClose={() => setEditing(null)} isNew={!ws.policies.some((p) => p.id === editing.id)} />}
    </div>
  );
}

function PolicyRow({ policy: p, canEdit, onToggle, onOpen }: { policy: Policy; canEdit: boolean; onToggle: () => void; onOpen: () => void }) {
  const ws = useWs();
  const reach = useMemo(() => policyReach(p, ws), [p, ws]);
  const eff = EFFECT_META[p.effect];
  return (
    <Card className={cx('p-4 transition-opacity', !p.active && 'opacity-60')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <button className="min-w-0 flex-1 text-left" onClick={onOpen}>
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone="muted">{KIND_LABEL[p.kind]}</Chip>
            <Chip tone={eff.tone} icon={ShieldCheck}>{eff.label}</Chip>
            <span className="text-sm font-semibold hover:text-primary">{p.name}</span>
          </div>
          <p className="mt-1 text-sm text-text-muted">{p.description}</p>
          <p className="mt-1 text-xs text-accent-soft">{describeCode(p.code, p.effect)}</p>
        </button>
        <div className="flex items-center gap-3">
          <div className="flex gap-1">{ENV_ORDER.filter((e) => p.envs.includes(e)).map((e) => <EnvBadge key={e} env={e} />)}</div>
          <Toggle on={p.active} disabled={!canEdit} onChange={onToggle} label={p.active ? 'Ativa' : 'Inativa'} />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
        <span className="mr-1 self-center text-xs text-text-muted">Onde aparece:</span>
        <Chip tone={reach.studio ? 'purple' : 'muted'} icon={Workflow}>Studio · {reach.studio} {reach.studio === 1 ? 'selo' : 'selos'} em nós</Chip>
        <Chip tone={reach.promocao ? 'purple' : 'muted'} icon={GitPullRequestArrow}>Promoção · {reach.promocao} {reach.promocao === 1 ? 'gate' : 'gates'}</Chip>
        <Chip tone={reach.construcao ? 'green' : 'muted'} icon={Hammer}>Construção · {reach.construcao} OC (hooks e validar_contra_padroes)</Chip>
        <Chip tone={reach.execucao ? 'red' : 'muted'} icon={Activity}>Execução · {reach.execucao} {reach.execucao === 1 ? 'guardrail' : 'guardrails'} no trace</Chip>
      </div>
    </Card>
  );
}

export function Toggle({ on, onChange, disabled, label }: { on: boolean; onChange: () => void; disabled?: boolean; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={onChange}
      title={disabled ? 'Somente CoE AI ou Segurança e compliance editam políticas' : label}
      className="inline-flex items-center gap-2 text-xs text-text-muted disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className={cx('relative h-5 w-9 rounded-full border transition-colors', on ? 'border-primary bg-primary/30' : 'border-border bg-surface-2')}>
        <span className={cx('absolute top-0.5 h-3.5 w-3.5 rounded-full transition-all', on ? 'left-[18px] bg-primary' : 'left-0.5 bg-text-muted')} />
      </span>
      {label}
    </button>
  );
}

function PolicyEditor({ policy, canEdit, onClose, isNew }: { policy: Policy; canEdit: boolean; onClose: () => void; isNew: boolean }) {
  const mutate = useCortex((s) => s.mutate);
  const replace = useCortex((s) => s.replaceWorkspace);
  const toast = useCortex((s) => s.toast);
  const initial = codeToRows(policy.code);
  const [name, setName] = useState(policy.name);
  const [description, setDescription] = useState(policy.description);
  const [kind, setKind] = useState<Policy['kind']>(policy.kind);
  const [effect, setEffect] = useState<Policy['effect']>(initial?.effect ?? policy.effect);
  const [envs, setEnvs] = useState<EnvId[]>(policy.envs);
  const [rows, setRows] = useState<CondRow[]>(initial?.rows ?? []);
  const [meta] = useState<Record<string, unknown>>(initial?.meta ?? {});
  const [code, setCode] = useState(policy.code);
  const [codeError, setCodeError] = useState<string | null>(initial ? null : 'O JSON atual não pôde ser lido; corrija na visão em código.');
  const [view, setView] = useState<'visual' | 'codigo'>('visual');

  const syncFromVisual = (nextRows: CondRow[], nextEffect: Policy['effect']) => {
    setRows(nextRows);
    setEffect(nextEffect);
    setCode(rowsToCode(nextRows, nextEffect, meta));
    setCodeError(null);
  };

  const onCodeChange = (txt: string) => {
    setCode(txt);
    const parsed = codeToRows(txt);
    if (!parsed) {
      setCodeError('JSON inválido: use { "when": { … }, "then": "bloquear" | "exigir_aprovacao" | "alertar" }.');
      return;
    }
    setCodeError(null);
    setRows(parsed.rows);
    if (parsed.effect) setEffect(parsed.effect);
  };

  const fieldOptions = useMemo(() => {
    const known = new Set(FIELDS.map((f) => f.value));
    const extra = rows.filter((r) => !known.has(r.field)).map((r) => ({ value: r.field, label: r.field }));
    return [...FIELDS, ...extra.filter((e, i, a) => a.findIndex((x) => x.value === e.value) === i)];
  }, [rows]);

  const sentence = describeCode(code, effect);
  const valid = name.trim().length > 2 && envs.length > 0 && !codeError;

  const save = () => {
    const condition = sentence.replace(/ então .*$/, '');
    const next: Policy = { ...policy, name: name.trim(), description: description.trim(), kind, effect, envs, condition, code };
    const before = mutate((d) => {
      const i = d.policies.findIndex((p) => p.id === policy.id);
      if (i >= 0) d.policies[i] = next;
      else d.policies.push(next);
    }, { action: isNew ? 'Criou política' : 'Editou política', object: next.name });
    toast({ kind: 'sucesso', title: isNew ? 'Política criada' : 'Política salva', description: `${next.name}: ${sentence}.`, undo: before ? () => replace(before) : undefined });
    onClose();
  };

  const remove = () => {
    const before = mutate((d) => {
      d.policies = d.policies.filter((p) => p.id !== policy.id);
    }, { action: 'Removeu política', object: policy.name });
    toast({ kind: 'aviso', title: 'Política removida', description: policy.name, undo: before ? () => replace(before) : undefined });
    onClose();
  };

  return (
    <Drawer
      open
      onClose={onClose}
      width={680}
      title={isNew ? 'Nova política' : policy.name}
      subtitle="Editor visual sincronizado com a visão em código"
      footer={
        canEdit ? (
          <div className="flex items-center justify-between gap-2">
            {!isNew ? <Button variant="ghost" size="sm" icon={Trash2} onClick={remove}>Remover</Button> : <span />}
            <div className="flex gap-2">
              <Button variant="tertiary" size="sm" onClick={onClose}>Cancelar</Button>
              <Button variant="primary" size="sm" disabled={!valid} onClick={save}>Salvar política</Button>
            </div>
          </div>
        ) : undefined
      }
    >
      <div className="space-y-4">
        {!canEdit && <NoPermission action="editar_politica" />}
        <fieldset disabled={!canEdit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
            <Field label="Nome"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Hml nunca recebe CPF aberto" /></Field>
            <Field label="Tipo">
              <Select value={kind} onChange={(e) => setKind(e.target.value as Policy['kind'])} options={[{ value: 'stack', label: 'Stack' }, { value: 'jornada', label: 'Jornada' }, { value: 'dado', label: 'Dado' }]} />
            </Field>
          </div>
          <Field label="Descrição"><Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-[56px]" /></Field>

          <Tabs<'visual' | 'codigo'>
            value={view}
            onChange={setView}
            tabs={[
              { id: 'visual', label: <span className="inline-flex items-center gap-1.5"><SlidersHorizontal className="h-3.5 w-3.5" />Visual</span> },
              { id: 'codigo', label: <span className="inline-flex items-center gap-1.5"><Code2 className="h-3.5 w-3.5" />Código</span> },
            ]}
          />

          {view === 'visual' ? (
            <div className="space-y-3">
              <div className="rounded-card border border-border bg-surface-2/50 p-3">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-accent">Quando</div>
                {rows.length === 0 && <p className="mb-2 text-xs text-text-muted">Sem condições: a política vale sempre.</p>}
                <div className="space-y-2">
                  {rows.map((r, i) => (
                    <div key={r.id} className="grid grid-cols-[28px_1fr_1fr_1fr_32px] items-center gap-2">
                      <span className="text-center text-xs text-text-muted">{i === 0 ? '' : 'e'}</span>
                      <Select aria-label="Campo" value={r.field} options={fieldOptions} onChange={(e) => syncFromVisual(rows.map((x) => (x.id === r.id ? { ...x, field: e.target.value } : x)), effect)} />
                      <Select aria-label="Operador" value={r.op} options={OPS} onChange={(e) => syncFromVisual(rows.map((x) => (x.id === r.id ? { ...x, op: e.target.value as CondRow['op'] } : x)), effect)} />
                      <Input aria-label="Valor" value={r.value} placeholder="valor" onChange={(e) => syncFromVisual(rows.map((x) => (x.id === r.id ? { ...x, value: e.target.value } : x)), effect)} />
                      <button aria-label="Remover condição" className="text-text-muted hover:text-danger" onClick={() => syncFromVisual(rows.filter((x) => x.id !== r.id), effect)}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={Plus}
                  className="mt-2"
                  onClick={() => syncFromVisual([...rows, { id: newRowId(), field: 'env', op: 'eq', value: 'prd' }], effect)}
                >
                  Adicionar condição
                </Button>
              </div>
              <div className="grid gap-3 rounded-card border border-border bg-surface-2/50 p-3 sm:grid-cols-2">
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-accent">Então</div>
                  <Select
                    aria-label="Efeito"
                    value={effect}
                    onChange={(e) => syncFromVisual(rows, e.target.value as Policy['effect'])}
                    options={[{ value: 'bloquear', label: 'Bloquear' }, { value: 'exigir_aprovacao', label: 'Exigir aprovação' }, { value: 'alertar', label: 'Alertar' }]}
                  />
                </div>
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-accent">Ambientes</div>
                  <div className="flex gap-3 pt-2">
                    {ENV_ORDER.map((e) => (
                      <label key={e} className="inline-flex cursor-pointer items-center gap-1.5 text-sm">
                        <input
                          type="checkbox"
                          className="accent-[#00FF95]"
                          checked={envs.includes(e)}
                          onChange={(ev) => setEnvs(ev.target.checked ? ENV_ORDER.filter((x) => x === e || envs.includes(x)) : envs.filter((x) => x !== e))}
                        />
                        {ENVS[e].label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <Textarea value={code} onChange={(e) => onCodeChange(e.target.value)} spellCheck={false} className="min-h-[260px] font-mono text-xs text-accent-soft" />
              {codeError && <p className="mt-1 text-xs text-danger">{codeError}</p>}
            </div>
          )}
        </fieldset>

        <div className="rounded-card border border-accent/40 bg-accent/5 p-3">
          <div className="mb-1 flex items-center gap-2 text-xs text-text-muted">
            <Chip tone={EFFECT_META[effect].tone} icon={ShieldCheck}>{EFFECT_META[effect].label}</Chip>
            Leitura da regra pelo motor de políticas
          </div>
          <p className="text-sm">{sentence}{envs.length ? ` · em ${envs.map((e) => ENVS[e].label).join(', ')}` : ''}.</p>
        </div>
      </div>
    </Drawer>
  );
}
