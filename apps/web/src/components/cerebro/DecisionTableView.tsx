'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, BookMarked, CheckCircle2, CircleDot, FlaskConical, Loader2, Plus, Save, Undo2, UploadCloud, XCircle, Boxes, Workflow, ShieldCheck,
} from 'lucide-react';
import type { Approval, DecisionTable } from '@cortex/schemas';
import { evaluateDecisionTable, type DecisionResult, type DecisionValue } from '@cortex/engine';
import { useCortex, useEnv, useWs, demoNow } from '@/lib/store';
import { emitTourAction, sleep } from '@/lib/tour-bus';
import { Button, Card, CardHeader, Chip, EnvBadge, Input, Mono, NoPermission, Select, StatusChip, cx, useCan } from '@/components/ui';
import { buildRuleComponent, bumpMinor, isTablePublishedFromBrain, journeysUsingTable } from './lib';

export interface DecisionTableApi {
  tableId: string;
  runTest: (opts?: { reset?: boolean }) => Promise<void>;
  publish: () => Promise<void>;
}

type Values = Record<string, string>;

function toInput(t: DecisionTable): Values {
  return Object.fromEntries(t.inputs.map((i) => [i.key, String(t.sampleCase[i.key] ?? '')]));
}

function parseValues(t: DecisionTable, v: Values): Record<string, DecisionValue> {
  const out: Record<string, DecisionValue> = {};
  for (const i of t.inputs) {
    const raw = v[i.key] ?? '';
    if (i.type === 'number') out[i.key] = Number(raw.replace(',', '.'));
    else if (i.type === 'boolean') out[i.key] = raw === 'true';
    else out[i.key] = raw;
  }
  return out;
}

function fmtValue(v: string, type: string) {
  if (type === 'boolean') return v === 'true' ? 'Sim' : 'Não';
  return v;
}

const PUBLISH_STEPS = ['Gerando o componente Rule a partir da tabela', 'Checagens automáticas: formato, segurança e casos de teste', 'Aprovação do CoE AI registrada'];

export function DecisionTableView({ table, apiRef, onBack }: { table: DecisionTable; apiRef: MutableRefObject<DecisionTableApi | null>; onBack: () => void }) {
  const ws = useWs();
  const env = useEnv();
  const router = useRouter();
  const mutate = useCortex((s) => s.mutate);
  const replaceWorkspace = useCortex((s) => s.replaceWorkspace);
  const toast = useCortex((s) => s.toast);
  const canEdit = useCan('editar_regra');

  const [draft, setDraft] = useState<DecisionTable>(table);
  const dirty = JSON.stringify(draft) !== JSON.stringify(table);
  const tableKey = JSON.stringify(table);
  useEffect(() => setDraft(table), [tableKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const [values, setValues] = useState<Values>(() => toInput(table));
  useEffect(() => setValues(toInput(table)), [table.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const [result, setResult] = useState<DecisionResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [publishing, setPublishing] = useState<number | null>(null);

  const linked = table.componentId ? ws.components.find((c) => c.id === table.componentId) : undefined;
  const published = isTablePublishedFromBrain(ws, table);
  const journeys = useMemo(() => journeysUsingTable(ws, table.id), [ws, table.id]);
  const domain = ws.domains.find((d) => d.id === table.domainId);
  const availableInEnv = linked ? (env === 'prd' ? linked.status === 'publicado_prd' : ['homologado', 'publicado_prd', 'depreciado'].includes(linked.status)) : false;

  const draftRef = useRef(draft);
  draftRef.current = draft;
  const valuesRef = useRef(values);
  valuesRef.current = values;

  const runTest = useCallback(async (opts?: { reset?: boolean }) => {
    let v = valuesRef.current;
    if (opts?.reset) {
      v = toInput(table);
      setValues(v);
      await sleep(500);
    }
    setTesting(true);
    setResult(null);
    await sleep(550);
    const r = evaluateDecisionTable(draftRef.current, parseValues(draftRef.current, v));
    setResult(r);
    setTesting(false);
    emitTourAction('regra.testar-caso');
  }, [table]);

  const publish = useCallback(async () => {
    if (publishing !== null) return;
    for (let i = 0; i < PUBLISH_STEPS.length; i++) {
      setPublishing(i);
      await sleep(520);
    }
    const s = useCortex.getState();
    const current = s.activeWorkspaceId ? s.workspaces[s.activeWorkspaceId] : null;
    if (!current) return;
    const t = current.decisionTables.find((x) => x.id === table.id) ?? table;
    const at = demoNow();
    const comp = buildRuleComponent(current, t, at);
    const before = mutate(
      (d) => {
        const idx = d.components.findIndex((c) => c.id === comp.id);
        if (idx >= 0) d.components[idx] = comp;
        else d.components.unshift(comp);
        const dt = d.decisionTables.find((x) => x.id === t.id);
        if (dt) dt.componentId = comp.id;
        const art = d.artifacts.find((a) => a.areaId === 'area-regras' && a.title === t.name);
        if (art) art.componentId = comp.id;
        const ap: Approval = {
          id: `${comp.id}-ap-${Date.now()}`, kind: 'componente', title: `Publicar "${comp.name}" ${comp.version}`,
          requestedBy: d.users.find((u) => u.profile === s.profile)?.name ?? 'Usuário da demo', requestedAt: at, status: 'aprovado',
          approverProfile: 'coe', objectId: comp.id, comments: [{ by: comp.approvals[0].by, at, text: comp.approvals[0].note ?? 'Aprovado.' }],
        };
        d.approvals = [ap, ...d.approvals];
      },
      { action: 'Publicou regra como componente Rule', object: `${comp.name} ${comp.version}` },
    );
    setPublishing(null);
    toast({
      kind: 'sucesso',
      title: 'Regra publicada no Catálogo',
      description: `${comp.name} ${comp.version} · Homologado pelo CoE AI. Abra em Catálogo › ${comp.name}.`,
      undo: before ? () => replaceWorkspace(before) : undefined,
    });
    emitTourAction('regra.publicar');
  }, [publishing, table, mutate, replaceWorkspace, toast]);

  useEffect(() => {
    apiRef.current = { tableId: table.id, runTest, publish };
    return () => {
      if (apiRef.current?.tableId === table.id) apiRef.current = null;
    };
  }, [apiRef, table.id, runTest, publish]);

  const saveVersion = () => {
    const version = bumpMinor(table.version);
    const before = mutate(
      (d) => {
        const i = d.decisionTables.findIndex((x) => x.id === table.id);
        if (i >= 0) d.decisionTables[i] = { ...draft, version };
      },
      { action: 'Editou tabela de decisão', object: `${table.name} ${version}` },
    );
    setResult(null);
    toast({ kind: 'sucesso', title: `Nova versão ${version} salva`, description: 'A versão anterior fica no histórico.', undo: before ? () => replaceWorkspace(before) : undefined });
  };

  const setCond = (rowIdx: number, key: string, v: string, kind: 'conditions' | 'outputs') =>
    setDraft((d) => ({ ...d, rows: d.rows.map((r, i) => (i === rowIdx ? { ...r, [kind]: { ...r[kind], [key]: v } } : r)) }));

  const addRow = () =>
    setDraft((d) => ({
      ...d,
      rows: [...d.rows, { id: `r${d.rows.length + 1}-${Date.now() % 1000}`, conditions: Object.fromEntries(d.inputs.map((i) => [i.key, '*'])), outputs: Object.fromEntries(d.outputs.map((o) => [o.key, ''])) }],
    }));

  const firedId = result?.row?.id;
  const testedRows = result ? Array.from(new Set(result.trace.map((t) => t.rowId))) : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={onBack}>
          Regras de negócio
        </Button>
        <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
          <span>Ambiente ativo</span>
          <EnvBadge env={env} />
          {linked ? (
            availableInEnv ? <Chip tone="green" icon={CheckCircle2}>Componente disponível neste ambiente</Chip> : <Chip tone="yellow" icon={CircleDot}>Componente ainda não disponível neste ambiente</Chip>
          ) : (
            <Chip tone="muted" icon={CircleDot}>Ainda não publicada como componente</Chip>
          )}
        </div>
      </div>

      <Card data-tour="regra-tabela">
        <CardHeader
          icon={BookMarked}
          title={
            <span className="flex items-center gap-2">
              {table.name} <Mono className="text-accent-soft">v{table.version}</Mono>
            </span>
          }
          subtitle={`${domain?.name ?? 'Domínio'} · primeira linha que casa vence`}
          actions={
            <span data-tour="regra-publicar" className="inline-flex rounded-full">
              {published ? (
                <Button size="sm" variant="primary" icon={Boxes} onClick={() => router.push(`/catalogo?id=${encodeURIComponent(table.componentId!)}`)}>
                  Ver no Catálogo
                </Button>
              ) : (
                <Button size="sm" variant="primary" icon={UploadCloud} loading={publishing !== null} disabled={!canEdit || dirty} onClick={() => void publish()} title={dirty ? 'Salve a nova versão antes de publicar' : undefined}>
                  Publicar como componente Rule
                </Button>
              )}
            </span>
          }
        />
        <div className="space-y-3 p-4">
          <p className="text-sm text-text-muted">{table.description}</p>
          <div className="flex flex-wrap gap-2">
            {table.source && <Chip tone="lilac" icon={BookMarked}>Origem: {table.source}</Chip>}
            {linked && (
              <button onClick={() => router.push(`/catalogo?id=${encodeURIComponent(linked.id)}`)} className="rounded-full">
                <Chip tone="purple" icon={Boxes}>Componente: {linked.name} {linked.version}</Chip>
              </button>
            )}
            {journeys.map((j) => (
              <Chip key={j.id} tone="muted" icon={Workflow}>{j.name}</Chip>
            ))}
          </div>

          {publishing !== null && (
            <div className="space-y-1.5 rounded-field border border-primary/40 bg-primary/5 p-3">
              {PUBLISH_STEPS.map((s, i) => (
                <div key={s} className={cx('flex items-center gap-2 text-sm', i > publishing && 'opacity-40')}>
                  {i < publishing ? <CheckCircle2 className="h-4 w-4 text-primary" /> : i === publishing ? <Loader2 className="h-4 w-4 animate-spin text-primary-soft" /> : <CircleDot className="h-4 w-4 text-text-muted" />}
                  {s}
                </div>
              ))}
            </div>
          )}
          {published && publishing === null && (
            <div className="flex flex-wrap items-center gap-3 rounded-field border border-primary/40 bg-primary/5 px-3 py-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <span className="flex-1">Publicada no Catálogo como componente Rule <Mono>v{table.version}</Mono>, aprovada pelo CoE AI e pronta para jornadas, Studio e MCP.</span>
              <StatusChip status={ws.components.find((c) => c.id === table.componentId)?.status ?? 'homologado'} />
            </div>
          )}

          {!canEdit && <NoPermission action="editar_regra" />}

          <div className="overflow-auto rounded-card border border-border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-surface-2">
                <tr>
                  <th className="w-10 px-2 py-2 text-left text-xs font-medium text-text-muted">#</th>
                  {table.inputs.map((i) => (
                    <th key={i.key} className="whitespace-nowrap px-2 py-2 text-left text-xs font-medium text-accent">
                      {i.label}
                      <span className="ml-1 font-mono text-[11px] text-text-muted">{i.key}</span>
                    </th>
                  ))}
                  {table.outputs.map((o, oi) => (
                    <th key={o.key} className={cx('whitespace-nowrap px-2 py-2 text-left text-xs font-medium text-primary-soft', oi === 0 && 'border-l border-border')}>
                      {o.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {draft.rows.map((r, ri) => {
                  const fired = r.id === firedId;
                  const tested = testedRows.includes(r.id) && !fired;
                  return (
                    <tr
                      key={r.id}
                      className={cx(
                        'border-t border-border transition-colors duration-200',
                        fired ? 'bg-primary/10 shadow-[inset_3px_0_0_#00FF95]' : tested ? 'bg-surface-1 opacity-70' : 'bg-surface-1',
                      )}
                    >
                      <td className="px-2 py-1.5 align-top">
                        <span className={cx('font-mono text-xs', fired ? 'font-semibold text-primary' : 'text-text-muted')}>{ri + 1}</span>
                      </td>
                      {draft.inputs.map((i) => (
                        <td key={i.key} className="px-2 py-1.5 align-top">
                          <Cell value={r.conditions[i.key] ?? '*'} editable={canEdit} mono onChange={(v) => setCond(ri, i.key, v, 'conditions')} label={`Linha ${ri + 1}, ${i.label}`} />
                        </td>
                      ))}
                      {draft.outputs.map((o, oi) => (
                        <td key={o.key} className={cx('px-2 py-1.5 align-top', oi === 0 && 'border-l border-border')}>
                          <Cell value={r.outputs[o.key] ?? ''} editable={canEdit} onChange={(v) => setCond(ri, o.key, v, 'outputs')} label={`Linha ${ri + 1}, ${o.label}`} />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-text-muted">
            <span>Condições: <Mono>*</Mono> qualquer · <Mono>=valor</Mono> · <Mono>&gt;=n</Mono> · <Mono>a..b</Mono> faixa · <Mono>v1|v2</Mono> um dos valores.</span>
            {canEdit && (
              <span className="flex items-center gap-2">
                <Button size="sm" variant="ghost" icon={Plus} onClick={addRow}>Adicionar linha</Button>
                {dirty && (
                  <>
                    <Chip tone="yellow" icon={CircleDot}>Alterações não salvas</Chip>
                    <Button size="sm" variant="ghost" icon={Undo2} onClick={() => setDraft(table)}>Descartar</Button>
                    <Button size="sm" variant="secondary" icon={Save} onClick={saveVersion}>Salvar versão {bumpMinor(table.version)}</Button>
                  </>
                )}
              </span>
            )}
          </div>
        </div>
      </Card>

      <Card data-tour="regra-testar">
        <CardHeader icon={FlaskConical} title="Testar caso" subtitle="Informe um caso e veja qual linha da tabela decide, com o rastro da avaliação" />
        <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              {table.inputs.map((i) => (
                <label key={i.key} className="block">
                  <span className="mb-1 block text-xs font-medium text-text-muted">{i.label}</span>
                  {i.type === 'enum' ? (
                    <Select value={values[i.key] ?? ''} onChange={(e) => setValues({ ...values, [i.key]: e.target.value })} options={(i.options ?? []).map((o) => ({ value: o, label: o }))} />
                  ) : i.type === 'boolean' ? (
                    <Select value={values[i.key] ?? 'false'} onChange={(e) => setValues({ ...values, [i.key]: e.target.value })} options={[{ value: 'true', label: 'Sim' }, { value: 'false', label: 'Não' }]} />
                  ) : (
                    <Input type={i.type === 'number' ? 'number' : 'text'} step="any" value={values[i.key] ?? ''} onChange={(e) => setValues({ ...values, [i.key]: e.target.value })} />
                  )}
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="primary" icon={FlaskConical} loading={testing} onClick={() => void runTest()}>
                Testar caso
              </Button>
              <Button variant="ghost" onClick={() => { setValues(toInput(table)); setResult(null); }}>
                Usar caso de exemplo
              </Button>
            </div>
          </div>

          <div className="min-h-[160px] rounded-field border border-border bg-surface-2 p-3">
            {testing ? (
              <div className="flex h-full items-center justify-center gap-2 text-sm text-text-muted"><Loader2 className="h-4 w-4 animate-spin" />Avaliando linha a linha…</div>
            ) : !result ? (
              <div className="flex h-full flex-col items-center justify-center text-center text-sm text-text-muted">
                <FlaskConical className="mb-2 h-6 w-6" strokeWidth={1.25} />
                O resultado aparece aqui, com a linha que disparou destacada na tabela.
              </div>
            ) : (
              <div className="space-y-3">
                {result.row ? (
                  <div className="rounded-field border border-primary/50 bg-primary/5 p-3 shadow-halo-green">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <CheckCircle2 className="h-4 w-4 text-primary" /> Linha {result.matchedIndex + 1} disparou
                    </div>
                    <dl className="mt-2 grid gap-1 text-sm">
                      {table.outputs.map((o) => (
                        <div key={o.key} className="flex gap-2">
                          <dt className="w-28 shrink-0 text-text-muted">{o.label}</dt>
                          <dd className="font-medium">{result.row!.outputs[o.key]}</dd>
                        </div>
                      ))}
                    </dl>
                    {result.row.note && <p className="mt-2 text-xs text-text-muted">{result.row.note}</p>}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-field border border-warning/50 bg-warning/5 p-3 text-sm">
                    <XCircle className="h-4 w-4 text-warning" /> Nenhuma linha casou. Sugestão: adicione uma linha com <Mono>*</Mono> como regra padrão.
                  </div>
                )}
                <div>
                  <div className="mb-1 text-xs font-medium text-text-muted">Rastro da avaliação</div>
                  <ul className="space-y-1">
                    {testedRows.map((rowId) => {
                      const idx = draft.rows.findIndex((r) => r.id === rowId);
                      const checks = result.trace.filter((t) => t.rowId === rowId);
                      const ok = checks.every((c) => c.ok);
                      const failed = checks.filter((c) => !c.ok);
                      return (
                        <li key={rowId} className="flex flex-wrap items-center gap-2 text-xs">
                          {ok ? <Chip tone="green" icon={CheckCircle2}>Linha {idx + 1}: disparou</Chip> : <Chip tone="muted" icon={XCircle}>Linha {idx + 1}: não casou</Chip>}
                          <span className="text-text-muted">
                            {ok
                              ? checks.map((c) => `${table.inputs.find((i) => i.key === c.key)?.label ?? c.key} ${c.condition}`).join(' · ')
                              : failed.map((c) => `${table.inputs.find((i) => i.key === c.key)?.label ?? c.key}: ${fmtValue(values[c.key] ?? '', table.inputs.find((i) => i.key === c.key)?.type ?? 'string')} não atende ${c.condition}`).join(' · ')}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
                <p className="flex items-center gap-1.5 text-xs text-text-muted">
                  <ShieldCheck className="h-3.5 w-3.5" /> A mesma regra roda como nó no Studio e como recurso no MCP do Córtex.
                </p>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

function Cell({ value, editable, onChange, mono, label }: { value: string; editable: boolean; onChange: (v: string) => void; mono?: boolean; label: string }) {
  if (!editable) return <span className={cx(mono ? 'font-mono text-xs' : 'text-sm', value === '*' && 'text-text-muted')}>{value}</span>;
  return (
    <input
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cx(
        'w-full min-w-[90px] rounded-field border border-transparent bg-transparent px-1.5 py-1 hover:border-border focus:border-primary focus:bg-surface-2 focus:outline-none',
        mono ? 'font-mono text-xs' : 'text-sm',
        value === '*' && 'text-text-muted',
      )}
    />
  );
}
