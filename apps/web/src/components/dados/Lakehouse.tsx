'use client';

import { useState } from 'react';
import type { LakeTable, SqlExample, WorkspaceData } from '@cortex/schemas';
import { formatNumber, relativeTime } from '@cortex/engine';
import { PROFILES, ENVS } from '@cortex/schemas';
import { ArrowRight, Database, Play, ShieldAlert, Info, Terminal } from 'lucide-react';
import { Button, Card, Chip, Drawer, Mono, Tabs, Table, Textarea, Term, cx } from '@/components/ui';
import { demoNow, useEnv, useProfile } from '@/lib/store';
import { maskValue } from './shared';

const LAYERS: { id: LakeTable['layer']; label: string; desc: string; tone: string }[] = [
  { id: 'bronze', label: 'Bronze', desc: 'Dado bruto como chega do conector', tone: 'border-warning/50 text-warning' },
  { id: 'prata', label: 'Prata', desc: 'Limpo, conformado e com PII tratada', tone: 'border-accent-soft/50 text-accent-soft' },
  { id: 'ouro', label: 'Ouro', desc: 'Produtos de dados prontos para consumo', tone: 'border-primary/50 text-primary' },
];

export function LakehouseTab({ ws, tableId, onTable }: { ws: WorkspaceData; tableId: string | null; onTable: (id: string | null) => void }) {
  const table = ws.tables.find((t) => t.id === tableId) ?? null;
  const [view, setView] = useState<'previa' | 'perfil' | 'sql'>('previa');

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-text-muted">
          <Term term="lakehouse">Lakehouse</Term> em camadas, da esquerda para a direita. Clique em uma tabela para abrir o explorador.
        </p>
        <Button
          size="sm"
          variant="tertiary"
          icon={Terminal}
          onClick={() => {
            const first = ws.tables.find((t) => t.layer === 'ouro') ?? ws.tables[0];
            if (first) {
              setView('sql');
              onTable(first.id);
            }
          }}
        >
          Consultar com SQL
        </Button>
      </div>
      <div className="grid gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr]">
        {LAYERS.map((layer, i) => {
          const tables = ws.tables.filter((t) => t.layer === layer.id);
          return [
            <div key={layer.id} className="min-w-0 rounded-card border border-border bg-bg p-3">
              <div className="mb-3 flex items-center justify-between">
                <span className={cx('rounded-full border px-2.5 py-0.5 text-xs font-semibold', layer.tone)}>{layer.label}</span>
                <span className="text-xs text-text-muted">{tables.length} tabelas</span>
              </div>
              <p className="mb-3 text-xs text-text-muted">{layer.desc}</p>
              <div className="space-y-2">
                {tables.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setView('previa');
                      onTable(t.id);
                    }}
                    className="w-full rounded-field border border-border bg-surface-1 px-3 py-2 text-left transition-colors hover:border-accent"
                  >
                    <div className="flex items-center gap-1.5">
                      <Database className="h-3.5 w-3.5 shrink-0 text-text-muted" strokeWidth={1.5} />
                      <Mono className="truncate">{t.name}</Mono>
                      {t.columns.some((c) => c.pii) && <ShieldAlert className="ml-auto h-3.5 w-3.5 shrink-0 text-danger" aria-label="Contém PII" />}
                    </div>
                    <div className="mt-1 flex justify-between text-xs text-text-muted">
                      <span>{formatNumber(t.rows)} linhas</span>
                      <span>atualizada {relativeTime(t.updatedAt, demoNow())}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>,
            i < LAYERS.length - 1 ? (
              <div key={`${layer.id}-arrow`} className="hidden items-center justify-center lg:flex">
                <ArrowRight className="h-5 w-5 text-text-muted" />
              </div>
            ) : null,
          ];
        })}
      </div>

      <Drawer
        open={!!table}
        onClose={() => onTable(null)}
        width={760}
        title={table ? <Mono className="text-base">{table.name}</Mono> : ''}
        subtitle={table ? `${LAYERS.find((l) => l.id === table.layer)?.label} · ${formatNumber(table.rows)} linhas · domínio ${ws.domains.find((d) => d.id === table.domainId)?.name ?? table.domainId}` : undefined}
      >
        {table && (
          <div className="space-y-4">
            <Tabs
              value={view}
              onChange={setView}
              tabs={[
                { id: 'previa', label: 'Prévia' },
                { id: 'perfil', label: 'Perfil das colunas' },
                { id: 'sql', label: 'SQL' },
              ]}
            />
            {view === 'previa' && <Preview table={table} />}
            {view === 'perfil' && <Profile table={table} />}
            {view === 'sql' && <SqlEditor examples={ws.sqlExamples} />}
          </div>
        )}
      </Drawer>
    </div>
  );
}

function Preview({ table }: { table: LakeTable }) {
  const env = useEnv();
  const profile = useProfile();
  const hasPii = table.columns.some((c) => c.pii);
  return (
    <div className="space-y-2">
      {hasPii && (
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <ShieldAlert className="h-4 w-4 text-danger" strokeWidth={1.5} />
          Colunas PII mascaradas para {PROFILES[profile].label} em {ENVS[env].label}.
        </div>
      )}
      <div className="overflow-auto rounded-card border border-border">
        <table className="w-full text-xs">
          <thead className="bg-surface-2 text-left text-text-muted">
            <tr>
              {table.columns.map((c) => (
                <th key={c.name} className="whitespace-nowrap px-3 py-2 font-medium">
                  {c.name} {c.pii && <Chip tone="red">PII</Chip>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.sample.map((row, i) => (
              <tr key={i} className="border-t border-border">
                {table.columns.map((c) => (
                  <td key={c.name} className={cx('whitespace-nowrap px-3 py-1.5 font-mono', c.pii && 'text-text-muted')}>
                    {maskValue(row[c.name] ?? null, c.pii)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Profile({ table }: { table: LakeTable }) {
  return (
    <div className="space-y-2">
      {table.columns.map((c) => {
        const counts = new Map<string, number>();
        table.sample.forEach((r) => {
          const k = String(r[c.name] ?? '∅');
          counts.set(k, (counts.get(k) ?? 0) + 1);
        });
        const dist = [...counts.entries()].sort((a, b) => b[1] - a[1]);
        const total = table.sample.length || 1;
        const palette = ['bg-primary', 'bg-accent', 'bg-primary-soft', 'bg-accent-soft', 'bg-warning'];
        return (
          <Card key={c.name} className="p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Mono className="text-sm">{c.name}</Mono>
              <Chip tone="muted">{c.type}</Chip>
              {c.pii && <Chip tone="red" icon={ShieldAlert}>PII</Chip>}
              <span className="ml-auto text-xs text-text-muted">
                nulos {formatNumber(c.nullsPct, 1)}% · distintos {formatNumber(c.distinct)}
              </span>
            </div>
            <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-surface-2" title="Distribuição na amostra">
              {dist.slice(0, 5).map(([k, n], i) => (
                <div key={k} className={palette[i % palette.length]} style={{ width: `${(n / total) * 100}%` }} title={`${c.pii ? maskValue(k, true) : k}: ${n}`} />
              ))}
            </div>
            <div className="mt-1 text-[11px] text-text-muted">
              {c.distinct <= 10
                ? `Distribuição na amostra: ${dist.slice(0, 4).map(([k, n]) => `${c.pii ? maskValue(k, true) : k} (${n})`).join(', ')}`
                : 'Alta cardinalidade: valores quase únicos na amostra.'}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').replace(/;\s*$/, '').trim();

function SqlEditor({ examples }: { examples: SqlExample[] }) {
  const [sql, setSql] = useState(examples[0]?.sql ?? '');
  const [result, setResult] = useState<SqlExample | 'desconhecida' | null>(null);
  const [running, setRunning] = useState(false);

  const run = () => {
    setRunning(true);
    setTimeout(() => {
      const hit = examples.find((e) => norm(e.sql) === norm(sql));
      setResult(hit ?? 'desconhecida');
      setRunning(false);
    }, 450);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {examples.map((e) => (
          <button
            key={e.id}
            onClick={() => {
              setSql(e.sql);
              setResult(null);
            }}
            className="rounded-full border border-border px-3 py-1 text-xs text-text-muted hover:border-accent hover:text-text"
          >
            {e.question}
          </button>
        ))}
      </div>
      <Textarea
        value={sql}
        onChange={(e) => setSql(e.target.value)}
        spellCheck={false}
        aria-label="Consulta SQL"
        className="min-h-[140px] font-mono text-xs"
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') run();
        }}
      />
      <div className="flex items-center gap-2">
        <Button size="sm" variant="primary" icon={Play} loading={running} onClick={run}>
          Executar
        </Button>
        <span className="text-xs text-text-muted">Ctrl + Enter executa. Resultados de demonstração.</span>
      </div>
      {result === 'desconhecida' && (
        <div className="flex items-start gap-2 rounded-card border border-warning/40 bg-warning/5 p-3 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-warning" strokeWidth={1.5} />
          <div>
            No modo demonstração só as consultas do roteiro são executadas. Escolha uma das perguntas acima; no modo conectado, a consulta roda no seu lakehouse.
          </div>
        </div>
      )}
      {result && result !== 'desconhecida' && (
        <Table
          dense
          rows={result.rows.map((r, i) => ({ i, r }))}
          rowKey={(x) => String(x.i)}
          columns={result.columns.map((c, ci) => ({
            key: c,
            header: c,
            render: (x: { r: (string | number)[] }) => <Mono>{typeof x.r[ci] === 'number' ? formatNumber(x.r[ci] as number) : x.r[ci]}</Mono>,
          }))}
        />
      )}
    </div>
  );
}
