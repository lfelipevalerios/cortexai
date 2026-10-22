'use client';

// Importar OpenAPI: especificação (JSON ou URL) → conector REST/OpenAPI com tools e objetos.
import { useRef, useState, type MutableRefObject } from 'react';
import { FileJson, Link2, Sparkles, Plus, AlertTriangle, CheckCircle2, Wand2, Lock } from 'lucide-react';
import type { Connector } from '@cortex/schemas';
import { parseOpenApi, slugifySnake, SAMPLE_OPENAPI_SPEC, type OpenApiImport as Parsed } from '@cortex/engine';
import { Button, Card, CardHeader, Chip, Field, Input, Mono, NoPermission, Textarea, cx } from '@/components/ui';
import { demoNow, useCortex, useEnv, useWs } from '@/lib/store';
import { emitTourAction, sleep } from '@/lib/tour-bus';
import { PREFIX, nextConnectorId, secretRefFor } from './helpers';
import { ModeChip, ObjectsView } from './parts';

export interface OpenApiHandle {
  runExample: () => Promise<void>;
}

/** Método HTTP de cada tool gerada, a partir da especificação. */
function methodsOf(spec: unknown): Map<string, string> {
  const m = new Map<string, string>();
  if (!spec || typeof spec !== 'object') return m;
  const paths = (spec as { paths?: Record<string, Record<string, { operationId?: string }>> }).paths ?? {};
  for (const [path, item] of Object.entries(paths)) {
    if (!item || typeof item !== 'object') continue;
    for (const [method, op] of Object.entries(item)) {
      if (!op || typeof op !== 'object') continue;
      const key = op.operationId ? slugifySnake(op.operationId) : `${method}:${path}`;
      m.set(key, method.toUpperCase());
    }
  }
  return m;
}

export function OpenApiImport({ handleRef, canCreate, onCreated }: { handleRef: MutableRefObject<OpenApiHandle | null>; canCreate: boolean; onCreated: (id: string) => void }) {
  const ws = useWs();
  const env = useEnv();
  const mutate = useCortex((s) => s.mutate);
  const toast = useCortex((s) => s.toast);
  const replace = useCortex((s) => s.replaceWorkspace);
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [fetching, setFetching] = useState(false);
  const [urlMsg, setUrlMsg] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<(Parsed & { methods: Map<string, string>; ms: number }) | null>(null);
  const [created, setCreated] = useState<string | null>(null);
  const textRef = useRef(text);
  textRef.current = text;
  const rootRef = useRef<HTMLDivElement>(null);

  const loadExample = () => {
    setText(JSON.stringify(SAMPLE_OPENAPI_SPEC, null, 2));
    setResult(null);
    setCreated(null);
    setUrlMsg(null);
  };

  const fetchUrl = async () => {
    const u = url.trim();
    if (!u) return;
    setFetching(true);
    setUrlMsg(null);
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 4000);
      const res = await fetch(u, { signal: ctl.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(String(res.status));
      setText(await res.text());
      setUrlMsg('Especificação carregada da URL.');
    } catch {
      setUrlMsg('Não foi possível buscar a URL (rede ou CORS). A demo funciona offline: cole o JSON abaixo ou use o exemplo.');
    } finally {
      setFetching(false);
    }
  };

  const generate = async (src?: string) => {
    const raw = src ?? textRef.current;
    if (!raw.trim()) return;
    setGenerating(true);
    setCreated(null);
    const t0 = performance.now();
    await sleep(900);
    let spec: unknown = null;
    try {
      spec = JSON.parse(raw);
    } catch {
      /* parseOpenApi reporta o erro */
    }
    const parsed = parseOpenApi(raw);
    setResult({ ...parsed, methods: methodsOf(spec), ms: Math.round(performance.now() - t0) });
    setGenerating(false);
    if (parsed.tools.length) emitTourAction('openapi.importar-exemplo');
  };

  handleRef.current = {
    runExample: async () => {
      rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      await sleep(500);
      const json = JSON.stringify(SAMPLE_OPENAPI_SPEC, null, 2);
      setResult(null);
      setCreated(null);
      setText(json);
      await sleep(700);
      await generate(json);
    },
  };

  const create = () => {
    if (!result || !result.tools.length) return;
    const p = PREFIX[ws.workspace.industry];
    const id = nextConnectorId(ws, `${p}-cn-openapi`);
    const n = id.split('-').pop();
    const target = env === 'prd' ? 'dev' : env;
    const now = demoNow();
    const c: Connector = {
      id,
      typeId: 'rest-openapi',
      name: `${result.title} · OpenAPI`,
      status: 'conectado',
      envs: { [target]: { endpoint: result.baseUrl ?? 'https://api.exemplo.com.br', secretRef: secretRefFor(ws.workspace.id, id, target) } },
      syncMode: 'sob_demanda',
      lastSync: now,
      volume: 0,
      latencyMs: 0,
      consumers: [],
      objects: result.objects,
      tools: result.tools.map((t) => ({ ...t, id: `${p}-tl-oa${n}-${t.id}` })),
      logs: [{ at: now, level: 'info', message: `Gerado a partir da especificação OpenAPI ${result.title} ${result.version}: ${result.tools.length} tools, ${result.objects.length} objetos.` }],
    };
    const before = mutate((d) => {
      d.connectors = [c, ...d.connectors];
    }, { action: 'Importou OpenAPI como conector', object: c.name });
    setCreated(id);
    toast({ kind: 'sucesso', title: `${c.name} criado em ${target === 'dev' ? 'Dev' : 'Hml'}`, description: `${c.tools.length} tools; escrita desligada em Prd.`, undo: before ? () => { replace(before); setCreated(null); } : undefined });
    onCreated(id);
  };

  const piiFields = result ? result.objects.reduce((s, o) => s + o.fields.filter((f) => f.pii).length, 0) : 0;

  return (
    <div ref={rootRef} data-tour="openapi-importar" className="scroll-mt-4">
      <Card>
        <CardHeader
          icon={FileJson}
          title="Importar OpenAPI"
          subtitle="Uma especificação OpenAPI vira conector com tools prontas para jornadas e agentes"
          actions={<Button size="sm" variant="tertiary" icon={Wand2} onClick={loadExample}>Usar exemplo</Button>}
        />
        <div className="grid gap-4 p-4 lg:grid-cols-2">
          <div className="space-y-3">
            <Field label="URL da especificação">
              <div className="flex gap-2">
                <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://api.exemplo.com.br/openapi.json" className="font-mono" />
                <Button variant="tertiary" icon={Link2} loading={fetching} disabled={!url.trim()} onClick={() => void fetchUrl()}>Buscar</Button>
              </div>
            </Field>
            {urlMsg && <p className={cx('text-xs', urlMsg.startsWith('Não') ? 'text-warning' : 'text-primary')}>{urlMsg}</p>}
            <Field label="Ou cole o JSON da especificação (OpenAPI 3.x ou Swagger 2.0)">
              <Textarea value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} className="h-64 font-mono text-xs" placeholder='{ "openapi": "3.0.3", "info": { ... }, "paths": { ... } }' />
            </Field>
            <Button variant="primary" icon={Sparkles} loading={generating} disabled={!text.trim()} onClick={() => void generate()}>
              Gerar conector e tools
            </Button>
          </div>

          <div className="min-w-0">
            {!result && !generating && (
              <div className="flex h-full min-h-[200px] flex-col items-center justify-center rounded-card border border-dashed border-border p-6 text-center text-sm text-text-muted">
                <FileJson className="mb-2 h-8 w-8" strokeWidth={1} />
                As tools geradas aparecem aqui: nome, método e modo (leitura ou escrita).
              </div>
            )}
            {generating && (
              <div className="space-y-2">
                {[0, 1, 2, 3].map((i) => <div key={i} className="h-10 animate-pulse rounded-field bg-surface-2" />)}
              </div>
            )}
            {result && !generating && (
              <div className="space-y-3">
                {result.tools.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip tone="green" icon={CheckCircle2}>{result.title} {result.version}</Chip>
                    <span className="text-xs text-text-muted">{result.tools.length} tools e {result.objects.length} objetos em {(result.ms / 1000).toFixed(1).replace('.', ',')} s</span>
                  </div>
                ) : (
                  <div className="rounded-card border border-danger/40 bg-danger/5 p-3 text-sm">Nenhuma tool gerada. Verifique a especificação.</div>
                )}
                {result.errors.length > 0 && (
                  <ul className="space-y-1 rounded-card border border-warning/40 bg-warning/5 p-3 text-xs">
                    {result.errors.map((e) => <li key={e} className="flex gap-2"><AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning" />{e}</li>)}
                  </ul>
                )}
                {result.tools.length > 0 && (
                  <ul className="space-y-1.5">
                    {result.tools.map((t) => (
                      <li key={t.id} className="flex animate-fade-in items-center gap-2 rounded-field border border-border bg-surface-1 px-3 py-2">
                        <Mono className="w-14 shrink-0 text-accent">{result.methods.get(t.id) ?? (t.mode === 'leitura' ? 'GET' : 'POST')}</Mono>
                        <span className="min-w-0 flex-1">
                          <Mono className="block truncate">{t.name}</Mono>
                          <span className="block truncate text-xs text-text-muted">{t.description}</span>
                        </span>
                        <ModeChip mode={t.mode} />
                        {t.mode === 'escrita' && <Chip tone="muted" icon={Lock}>Prd desligada</Chip>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
        {result && result.objects.length > 0 && !generating && (
          <div className="space-y-2 border-t border-border p-4">
            <div className="text-sm font-semibold">Objetos do esquema {piiFields > 0 && <span className="font-normal text-text-muted">· {piiFields} campos PII marcados</span>}</div>
            <ObjectsView objects={result.objects} sampleRows={1} showRecords={false} />
          </div>
        )}
        {result && result.tools.length > 0 && !generating && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
            <p className="text-xs text-text-muted">Toda tool de escrita nasce desligada para agentes em Prd e exige política explícita.</p>
            {canCreate ? (
              created ? (
                <Chip tone="green" icon={CheckCircle2}>Conector criado: <Mono>{created}</Mono></Chip>
              ) : (
                <Button variant="primary" icon={Plus} onClick={create}>Criar conector</Button>
              )
            ) : (
              <div className="w-full"><NoPermission action="cadastrar_conector" /></div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
