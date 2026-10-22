'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { ContractField, DataClassification, WorkspaceData } from '@cortex/schemas';
import { contractToYaml, diffContractFields, latestContractVersion, relativeTime, compareVersions, type ContractDiff } from '@cortex/engine';
import { BREAKING_FIELD } from '@cortex/seed';
import {
  FileText, Plus, Trash2, Undo2, Upload, Lock, ArrowRight, Bot, Plug, AlertTriangle, CheckCircle2, Link2, History,
} from 'lucide-react';
import {
  Button, Card, CardHeader, Chip, StatusChip, Tabs, CodeBlock, DiffView, EmptyState, NoPermission, useCan, Mono, Modal,
  Field, Input, Select, IconButton, EnvBadge, cx,
} from '@/components/ui';
import { demoNow } from '@/lib/store';
import { ClassChip, CLASSIFICATION, FIELD_TYPES, Sparkline, emptyField, fieldsUsedInPrd, studioHref } from './shared';
import type { ContractEditor, EditorView } from './useContractEditor';

const QUALITY_KIND: Record<string, string> = { completude: 'Completude', unicidade: 'Unicidade', faixa: 'Faixa', frescor: 'Frescor', volume: 'Volume' };

export function ContratosTab({ ws, editor }: { ws: WorkspaceData; editor: ContractEditor }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      <ContractList ws={ws} editor={editor} />
      {editor.contract ? (
        <ContractEditorCard ws={ws} editor={editor} />
      ) : (
        <EmptyState
          icon={FileText}
          title="Selecione um contrato"
          description="O contrato é o acordo entre quem produz e quem consome um dado: campos, qualidade e frescor. Escolha um na lista para abrir o editor."
        />
      )}
    </div>
  );
}

function ContractList({ ws, editor }: { ws: WorkspaceData; editor: ContractEditor }) {
  return (
    <Card className="h-fit">
      <CardHeader title="Contratos" subtitle={`${ws.contracts.length} contratos de dados`} icon={FileText} />
      <ul className="p-2">
        {ws.contracts.map((c) => {
          const v = latestContractVersion(c);
          const dom = ws.domains.find((d) => d.id === c.domainId);
          const failing = v?.quality.some((q) => q.lastResult === 'falha');
          return (
            <li key={c.id}>
              <button
                onClick={() => editor.open(c.id)}
                className={cx(
                  'w-full rounded-field px-3 py-2 text-left transition-colors hover:bg-surface-2',
                  editor.contractId === c.id && 'bg-surface-2 ring-1 ring-accent/60',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">{c.name}</span>
                  <Mono className="text-text-muted">v{v?.version}</Mono>
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-text-muted">
                  <span className="truncate">{dom?.name ?? c.domainId}</span>
                  {failing && <Chip tone="red" icon={AlertTriangle}>Qualidade</Chip>}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function ContractEditorCard({ ws, editor }: { ws: WorkspaceData; editor: ContractEditor }) {
  const c = editor.contract!;
  const canPublish = useCan('publicar_contrato');
  const blocked = editor.publish?.kind === 'bloqueado';
  const breaking = BREAKING_FIELD[ws.workspace.industry];
  const dom = ws.domains.find((d) => d.id === c.domainId);

  return (
    <div className="min-w-0 space-y-3">
      <Card data-tour="contrato-visual">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-base font-semibold">{c.name}</span>
              <StatusChip status={c.status} />
              {editor.dirty && <Chip tone="yellow">Rascunho com alterações</Chip>}
            </div>
            <div className="mt-0.5 text-xs text-text-muted">
              Entidade {c.entity} · domínio {dom?.name ?? c.domainId} · dono {c.owner} · vigente <Mono>v{editor.latest?.version}</Mono>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {editor.draft && (
              <Button size="sm" variant="ghost" icon={Undo2} onClick={editor.discard}>
                Descartar rascunho
              </Button>
            )}
            {canPublish && (
              <Button
                size="sm"
                variant="primary"
                icon={Upload}
                data-tour={blocked ? undefined : 'contrato-publicar'}
                onClick={editor.tryPublish}
              >
                Publicar
              </Button>
            )}
          </div>
        </div>

        {!canPublish && (
          <div className="border-b border-border p-3">
            <NoPermission action="publicar_contrato" />
          </div>
        )}

        {editor.publish?.kind === 'bloqueado' && <BlockedPanel ws={ws} editor={editor} />}

        <div className="px-4 pt-2">
          <Tabs<EditorView>
            value={editor.view}
            onChange={editor.setView}
            tabs={[
              { id: 'visual', label: 'Visual' },
              { id: 'regras', label: 'Regras' },
              { id: 'codigo', label: 'Código' },
              { id: 'versoes', label: `Versões (${c.versions.length})` },
            ]}
          />
        </div>
        <div className="p-4">
          {editor.view === 'visual' && <VisualView ws={ws} editor={editor} editable={canPublish} breakingField={c.id === breaking.contractId ? breaking.field : undefined} />}
          {editor.view === 'regras' && <RulesView ws={ws} editor={editor} />}
          {editor.view === 'codigo' && <CodeView editor={editor} />}
          {editor.view === 'versoes' && <VersionsView key={`${c.id}-${c.versions.length}`} editor={editor} />}
        </div>
      </Card>

      <ContractToAgent editor={editor} />
      <PublishModal editor={editor} />
    </div>
  );
}

// ---------- Visual ----------
function VisualView({ ws, editor, editable, breakingField }: { ws: WorkspaceData; editor: ContractEditor; editable: boolean; breakingField?: string }) {
  const c = editor.contract!;
  const base = editor.latest?.fields ?? [];
  const usedInPrd = useMemo(() => fieldsUsedInPrd(c, ws), [c, ws]);
  const diff = editor.diff;
  const changed = new Set(diff?.changed.map((x) => x.after.name) ?? []);
  const draftNames = new Set(editor.fields.map((f) => f.name));
  const rows: { field: ContractField; state: 'ok' | 'removido' | 'novo' | 'alterado' }[] = [
    ...base.map((f) => {
      if (!draftNames.has(f.name)) return { field: f, state: 'removido' as const };
      const cur = editor.fields.find((x) => x.name === f.name)!;
      return { field: cur, state: changed.has(f.name) ? ('alterado' as const) : ('ok' as const) };
    }),
    ...editor.fields.filter((f) => !base.some((b) => b.name === f.name)).map((f) => ({ field: f, state: 'novo' as const })),
  ];
  const [adding, setAdding] = useState<ContractField | null>(null);
  const classOptions = (Object.keys(CLASSIFICATION) as DataClassification[]).map((k) => ({ value: k, label: CLASSIFICATION[k].label }));

  return (
    <div>
      <div className="rounded-card border border-accent/50 bg-bg">
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-accent" />
            <span className="font-semibold">{c.entity}</span>
            <span className="text-xs text-text-muted">{editor.fields.length} campos</span>
          </div>
          <div className="text-xs text-text-muted">Frescor {editor.latest?.freshness} · {editor.latest?.expectedVolume}</div>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-text-muted">
                <th className="px-4 py-2 font-medium">Campo</th>
                <th className="px-2 py-2 font-medium">Tipo</th>
                <th className="px-2 py-2 font-medium">Obrigatório</th>
                <th className="px-2 py-2 font-medium">Classificação</th>
                <th className="px-2 py-2 font-medium">Relação</th>
                <th className="w-1 px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ field: f, state }) => {
                const removed = state === 'removido';
                const used = usedInPrd.get(f.name);
                return (
                  <tr
                    key={f.name}
                    data-tour={f.name === breakingField ? 'contrato-campo-usado' : undefined}
                    data-field={f.name}
                    className={cx(
                      'border-t border-border transition-colors',
                      removed && 'bg-danger/10',
                      state === 'novo' && 'bg-primary/5',
                      state === 'alterado' && 'bg-warning/5',
                    )}
                  >
                    <td className="px-4 py-2">
                      <div className={cx('flex flex-wrap items-center gap-1.5', removed && 'text-danger line-through')}>
                        <Mono className="text-sm">{f.name}</Mono>
                        {state === 'novo' && <Chip tone="green" icon={Plus}>novo</Chip>}
                        {state === 'alterado' && <Chip tone="yellow">alterado</Chip>}
                        {removed && <Chip tone="red" icon={Trash2} className="no-underline">removido no rascunho</Chip>}
                        {used && !removed && (
                          <Chip tone="lilac" icon={Lock}>
                            usado em Prd
                          </Chip>
                        )}
                        {used && removed && <Chip tone="red" icon={AlertTriangle}>usado em Prd</Chip>}
                      </div>
                      <div className="mt-0.5 text-xs text-text-muted">{f.description}</div>
                    </td>
                    <td className="px-2 py-2">
                      {editable && !removed ? (
                        <select
                          aria-label={`Tipo de ${f.name}`}
                          value={f.type}
                          onChange={(e) => editor.updateField(f.name, { type: e.target.value })}
                          className="rounded-field border border-border bg-surface-2 px-2 py-1 font-mono text-xs"
                        >
                          {Array.from(new Set([...FIELD_TYPES, f.type])).map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                      ) : (
                        <Mono>{f.type}</Mono>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      {editable && !removed ? (
                        <label className="inline-flex items-center gap-1.5 text-xs">
                          <input type="checkbox" checked={f.required} onChange={(e) => editor.updateField(f.name, { required: e.target.checked })} className="accent-[#00FF95]" />
                          {f.required ? 'sim' : 'não'}
                        </label>
                      ) : (
                        <span className="text-xs">{f.required ? 'sim' : 'não'}</span>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      {editable && !removed ? (
                        <div className="flex items-center gap-1.5">
                          <ClassChip value={f.classification} />
                          <select
                            aria-label={`Classificação de ${f.name}`}
                            value={f.classification}
                            onChange={(e) => editor.updateField(f.name, { classification: e.target.value as DataClassification })}
                            className="rounded-field border border-border bg-surface-2 px-1 py-0.5 text-xs"
                          >
                            {classOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </div>
                      ) : (
                        <ClassChip value={f.classification} />
                      )}
                    </td>
                    <td className="px-2 py-2">
                      {f.ref ? <Chip tone="purple" icon={Link2}>{f.ref}</Chip> : <span className="text-xs text-text-muted">—</span>}
                    </td>
                    <td className="px-2 py-2 text-right">
                      {editable &&
                        (removed ? (
                          <IconButton icon={Undo2} label={`Restaurar ${f.name}`} onClick={() => editor.restoreField(f.name)} />
                        ) : (
                          <IconButton icon={Trash2} label={`Remover ${f.name}`} onClick={() => editor.removeField(f.name)} className="hover:text-danger" />
                        ))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {editable && (
          <div className="border-t border-border px-4 py-3">
            {adding ? (
              <div className="grid items-end gap-2 sm:grid-cols-[1.2fr_1fr_1fr_auto_auto]">
                <Field label="Nome do campo">
                  <Input value={adding.name} placeholder="ex.: canal_preferido" onChange={(e) => setAdding({ ...adding, name: e.target.value.replace(/\s+/g, '_').toLowerCase() })} />
                </Field>
                <Field label="Tipo">
                  <Select value={adding.type} onChange={(e) => setAdding({ ...adding, type: e.target.value })} options={FIELD_TYPES.map((t) => ({ value: t, label: t }))} />
                </Field>
                <Field label="Classificação">
                  <Select value={adding.classification} onChange={(e) => setAdding({ ...adding, classification: e.target.value as DataClassification })} options={classOptions} />
                </Field>
                <label className="mb-2 inline-flex items-center gap-1.5 text-xs">
                  <input type="checkbox" checked={adding.required} onChange={(e) => setAdding({ ...adding, required: e.target.checked })} className="accent-[#00FF95]" /> Obrigatório
                </label>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setAdding(null)}>Cancelar</Button>
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={!adding.name.trim() || editor.fields.some((f) => f.name === adding.name.trim())}
                    onClick={() => editor.addField(adding) && setAdding(null)}
                  >
                    Adicionar
                  </Button>
                </div>
              </div>
            ) : (
              <Button size="sm" variant="tertiary" icon={Plus} onClick={() => setAdding(emptyField())}>
                Adicionar campo
              </Button>
            )}
          </div>
        )}
      </div>
      {editor.draft && <DiffSummary diff={editor.diff} />}
    </div>
  );
}

function DiffSummary({ diff }: { diff: ContractDiff | null }) {
  if (!diff) return null;
  const empty = !diff.added.length && !diff.removed.length && !diff.changed.length;
  if (empty) return <p className="mt-3 text-xs text-text-muted">O rascunho ainda é igual à versão vigente.</p>;
  return (
    <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
      <div className="rounded-field border border-primary/30 bg-primary/5 p-2">
        <div className="mb-1 font-medium text-primary">Adicionados ({diff.added.length})</div>
        {diff.added.map((f) => <div key={f.name}><Mono>{f.name}</Mono></div>)}
      </div>
      <div className="rounded-field border border-danger/30 bg-danger/5 p-2">
        <div className="mb-1 font-medium text-danger">Removidos ({diff.removed.length})</div>
        {diff.removed.map((f) => <div key={f.name}><Mono>{f.name}</Mono></div>)}
      </div>
      <div className="rounded-field border border-warning/30 bg-warning/5 p-2">
        <div className="mb-1 font-medium text-warning">Alterados ({diff.changed.length})</div>
        {diff.changed.map((c) => <div key={c.after.name}><Mono>{c.after.name}</Mono>: {c.changes.join(', ')}</div>)}
      </div>
    </div>
  );
}

// ---------- Bloqueio ----------
function BlockedPanel({ ws, editor }: { ws: WorkspaceData; editor: ContractEditor }) {
  const p = editor.publish;
  if (p?.kind !== 'bloqueado') return null;
  const channelsOf = (journeyId: string) => ws.channels.filter((ch) => Object.values(ch.journeyByEnv).includes(journeyId));
  return (
    <div data-tour="contrato-publicar" className="m-3 animate-fade-in rounded-card border border-danger/60 bg-danger/5 p-4 shadow-halo-red">
      <div className="flex items-start gap-3">
        <Lock className="mt-0.5 h-5 w-5 shrink-0 text-danger" strokeWidth={1.5} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-danger">Publicação bloqueada</span>
            <StatusChip status="bloqueado" />
            <span className="text-xs text-text-muted">
              Versão proposta <Mono>v{p.nextVersion}</Mono> ({p.bump === 'major' ? 'mudança incompatível' : p.bump})
            </span>
          </div>
          <p className="mt-1 text-sm text-text-muted">
            O rascunho remove ou muda o tipo de campo usado por jornada em produção. Nada foi publicado; o contrato vigente continua valendo.
          </p>
          <ul className="mt-3 space-y-2">
            {p.consumers.map((b) => (
              <li key={`${b.journeyId}-${b.field}`} className="flex flex-wrap items-center gap-2 rounded-field border border-border bg-surface-1 px-3 py-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-danger" strokeWidth={1.5} />
                <Link href={studioHref(b.journeyId)} className="font-medium text-accent hover:underline">
                  {b.journeyName}
                </Link>
                <EnvBadge env={b.env} />
                <span className="text-text-muted">campo</span>
                <Mono className="text-danger">{b.field}</Mono>
                <span className="text-text-muted">· {b.reason}</span>
                {channelsOf(b.journeyId).map((ch) => <Chip key={ch.id} tone="muted">{ch.name}</Chip>)}
                <Link href={studioHref(b.journeyId)} className="ml-auto inline-flex items-center gap-1 text-xs text-accent hover:underline">
                  Abrir no Studio <ArrowRight className="h-3 w-3" />
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="tertiary" icon={Undo2} onClick={editor.discard}>Descartar rascunho</Button>
            <Button size="sm" variant="ghost" onClick={editor.closePublish}>Fechar</Button>
            <span className="self-center text-xs text-text-muted">Caminho seguro: publicar o campo como depreciado e migrar as jornadas antes de remover.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function PublishModal({ editor }: { editor: ContractEditor }) {
  const p = editor.publish;
  const [note, setNote] = useState('');
  const [version, setVersion] = useState('');
  useEffect(() => {
    if (p?.kind === 'confirmar') {
      setVersion(p.nextVersion);
      setNote('');
    }
  }, [p]);
  if (p?.kind !== 'confirmar') return null;
  const valid = /^\d+\.\d+\.\d+$/.test(version) && !!editor.latest && compareVersions(version, editor.latest.version) > 0;
  return (
    <Modal
      open
      onClose={editor.closePublish}
      title={`Publicar ${editor.contract?.name}`}
      subtitle="Sem consumidores em Prd afetados. A publicação gera nova versão semântica."
      footer={
        <>
          <Button variant="ghost" onClick={editor.closePublish}>Cancelar</Button>
          <Button variant="primary" icon={Upload} disabled={!valid} onClick={() => editor.confirmPublish(note, version)}>Publicar v{version}</Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <CheckCircle2 className="h-4 w-4 text-primary" /> Nenhuma jornada em Prd quebra com esta mudança.
        </div>
        <div className="text-sm">
          Sugestão: <Chip tone={p.bump === 'major' ? 'yellow' : 'green'}>{p.bump}</Chip>{' '}
          <span className="text-text-muted">
            {p.bump === 'major' ? 'campo removido ou tipo alterado' : p.bump === 'minor' ? 'campo adicionado' : 'ajuste sem mudança de estrutura'}
          </span>
        </div>
        <DiffSummary diff={p.diff} />
        <Field label="Versão" hint={valid ? undefined : 'Use x.y.z maior que a vigente.'}>
          <Input value={version} onChange={(e) => setVersion(e.target.value)} className="font-mono" />
        </Field>
        <Field label="Nota da versão">
          <Input value={note} placeholder="O que mudou e por quê" onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

// ---------- Regras ----------
function RulesView({ ws, editor }: { ws: WorkspaceData; editor: ContractEditor }) {
  const v = editor.latest;
  if (!v) return null;
  const dom = ws.domains.find((d) => d.id === editor.contract?.domainId);
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-3">
          <div className="text-xs text-text-muted">Frescor máximo</div>
          <div className="mt-1 font-mono text-lg text-primary">{v.freshness}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-text-muted">Volume esperado</div>
          <div className="mt-1 text-sm font-medium">{v.expectedVolume}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-text-muted">Responsável</div>
          <div className="mt-1 text-sm font-medium">{editor.contract?.owner}</div>
          <div className="text-xs text-text-muted">Dono do domínio: {dom?.owner}</div>
        </Card>
      </div>
      <div className="overflow-auto rounded-card border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-xs text-text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Regra</th>
              <th className="px-3 py-2 font-medium">Expressão</th>
              <th className="px-3 py-2 font-medium">Histórico</th>
              <th className="px-3 py-2 font-medium">Último resultado</th>
            </tr>
          </thead>
          <tbody>
            {v.quality.map((q) => (
              <tr key={q.id} className="border-t border-border">
                <td className="px-3 py-2">
                  {QUALITY_KIND[q.kind]}
                  {q.field && <span className="text-text-muted"> · <Mono>{q.field}</Mono></span>}
                </td>
                <td className="px-3 py-2"><Mono className="text-accent-soft">{q.expression}</Mono></td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Sparkline values={q.history} failing={q.lastResult === 'falha'} />
                    <span className="text-xs text-text-muted">{q.history[q.history.length - 1]?.toFixed(1)}%</span>
                  </div>
                </td>
                <td className="px-3 py-2"><StatusChip status={q.lastResult} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------- Código ----------
function CodeView({ editor }: { editor: ContractEditor }) {
  const c = editor.contract!;
  const v = editor.latest;
  const yaml = useMemo(() => {
    if (!v) return '';
    if (!editor.draft) return contractToYaml(c, v);
    return contractToYaml({ ...c, status: 'rascunho' }, { ...v, version: `${v.version}-rascunho`, publishedAt: demoNow(), note: 'Rascunho em edição', fields: editor.draft });
  }, [c, v, editor.draft]);
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-text-muted">
        <Chip tone="muted">Open Data Contract Standard v3</Chip>
        {editor.draft ? 'YAML do rascunho, sincronizado com a visão Visual.' : `YAML da versão vigente v${v?.version}.`}
      </div>
      <CodeBlock code={yaml} maxHeight={520} />
    </div>
  );
}

// ---------- Versões ----------
function VersionsView({ editor }: { editor: ContractEditor }) {
  const c = editor.contract!;
  const sorted = c.versions.slice().sort((a, b) => compareVersions(b.version, a.version));
  const [to, setTo] = useState(sorted[0]?.version ?? '');
  const [from, setFrom] = useState(sorted[1]?.version ?? sorted[0]?.version ?? '');
  const vf = c.versions.find((v) => v.version === from);
  const vt = c.versions.find((v) => v.version === to);
  const diff = vf && vt ? diffContractFields(vf.fields, vt.fields) : null;
  const opts = sorted.map((v) => ({ value: v.version, label: `v${v.version}` }));
  return (
    <div className="space-y-4">
      <ol className="space-y-2">
        {sorted.map((v, i) => (
          <li key={v.version} className="flex items-start gap-3 rounded-field border border-border px-3 py-2">
            <History className="mt-0.5 h-4 w-4 text-accent" strokeWidth={1.5} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Mono className="text-sm font-medium">v{v.version}</Mono>
                {i === 0 && <Chip tone="green">vigente</Chip>}
                <span className="text-xs text-text-muted">{v.author} · {relativeTime(v.publishedAt, demoNow())}</span>
              </div>
              <div className="text-xs text-text-muted">{v.note}</div>
            </div>
          </li>
        ))}
      </ol>
      {sorted.length > 1 && (
        <div>
          <div className="mb-2 flex flex-wrap items-end gap-2">
            <Field label="De"><Select value={from} onChange={(e) => setFrom(e.target.value)} options={opts} /></Field>
            <Field label="Para"><Select value={to} onChange={(e) => setTo(e.target.value)} options={opts} /></Field>
          </div>
          <DiffSummary diff={diff} />
          {vf && vt && (
            <div className="mt-3">
              <DiffView before={contractToYaml(c, vf)} after={contractToYaml(c, vt)} titleBefore={`v${vf.version}`} titleAfter={`v${vt.version}`} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- Do contrato para o agente ----------
function ContractToAgent({ editor }: { editor: ContractEditor }) {
  const c = editor.contract!;
  const varName = c.entity
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\W+/g, '_')
    .toLowerCase();
  return (
    <Card className="p-4">
      <div className="mb-2 text-sm font-semibold">Do contrato para o agente</div>
      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <div className="flex items-start gap-2">
          <Bot className="mt-0.5 h-4 w-4 shrink-0 text-accent" strokeWidth={1.5} />
          <div>
            Vira variável tipada no Studio de jornadas:{' '}
            <Mono className="text-accent-soft">{varName}: {c.entity}@{editor.latest?.version}</Mono>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Plug className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={1.5} />
          <div>
            Vira recurso no servidor MCP do Córtex: <Mono className="text-accent-soft">cortex://contratos/{c.id}</Mono>
          </div>
        </div>
      </div>
    </Card>
  );
}
