'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, KeyRound, Loader2, Package, PlugZap, RefreshCw, Radio } from 'lucide-react';
import { ENV_ORDER, ENVS, type EnvId, type IdeConnection, type IdeId } from '@cortex/schemas';
import { SEED_TODAY } from '@cortex/seed';
import { demoNow, useCortex, useEnv, useProfile, useWs } from '@/lib/store';
import { sleep } from '@/lib/tour-bus';
import { Button, Card, CardHeader, Chip, CodeBlock, Field, Mono, Select, Tabs, Term, cx } from '@/components/ui';
import {
  IDES, IDE_ORDER, MCP_ALL_TOOLS, MCP_URLS, PLUGIN_COMMANDS, WRITE_SET, addDays, brDate, ideConfig, makeToken,
} from './mcp';

const PREFIX: Record<string, string> = { saude: 'sau', varejo: 'var', financeiro: 'fin', telecom: 'tel' };

export function ConnectFlow() {
  const ws = useWs();
  const globalEnv = useEnv();
  const profile = useProfile();
  const mutate = useCortex((s) => s.mutate);
  const toast = useCortex((s) => s.toast);
  const user = ws.users.find((u) => u.profile === profile) ?? ws.users[0];
  const defaultProject = ws.ideConnections[0]?.project ?? ws.buildOrders[0]?.repo.split('/')[1] ?? 'meu-projeto';

  const [ide, setIde] = useState<IdeId>('claude_code');
  const [project, setProject] = useState(defaultProject);
  const [env, setEnv] = useState<EnvId>(globalEnv);
  const [url, setUrl] = useState(MCP_URLS[0].value);
  const [token, setToken] = useState<string | null>(null);
  const [cfgTab, setCfgTab] = useState(0);
  const [verify, setVerify] = useState<'idle' | 'waiting' | 'ok'>('idle');

  const projects = useMemo(() => {
    const set = new Set<string>([defaultProject, ...ws.ideConnections.map((c) => c.project), ...ws.buildOrders.map((b) => b.repo.split('/')[1])]);
    return [...set].filter(Boolean);
  }, [ws.ideConnections, ws.buildOrders, defaultProject]);

  const expires = brDate(addDays(SEED_TODAY, 30));
  const reset = () => {
    setToken(null);
    setVerify('idle');
  };

  const generate = () => {
    setToken(makeToken(ws.workspace.id, env, project, ide, user.id));
    setVerify('idle');
    setCfgTab(0);
  };

  const recognized = MCP_ALL_TOOLS;

  const check = async () => {
    if (!token) return;
    setVerify('waiting');
    await sleep(2000);
    setVerify('ok');
    const now = demoNow();
    let created = false;
    mutate(
      (d) => {
        const existing = d.ideConnections.find((c) => c.ide === ide && c.project === project && c.env === env && c.userId === user.id);
        if (existing) {
          existing.lastCallAt = now;
          existing.tools = recognized;
          return;
        }
        created = true;
        let n = d.ideConnections.length + 1;
        while (d.ideConnections.some((c) => c.id === `${PREFIX[d.workspace.industry]}-ide-${n}`)) n++;
        const conn: IdeConnection = {
          id: `${PREFIX[d.workspace.industry]}-ide-${n}`,
          ide,
          userId: user.id,
          project,
          env,
          connectedAt: now,
          lastCallAt: now,
          tools: recognized,
        };
        d.ideConnections.unshift(conn);
      },
      { action: 'Conectou IDE ao MCP do Córtex', object: `${IDES[ide].label} · ${project} (${ENVS[env].label})` },
    );
    toast({
      kind: 'sucesso',
      title: 'Primeiro contato recebido',
      description: `${IDES[ide].label} reconheceu ${recognized.length} ferramentas do Córtex${created ? '' : ' (conexão atualizada)'}.`,
    });
  };

  const configs = token ? ideConfig(ide, url, token) : [];

  return (
    <Card>
      <CardHeader icon={PlugZap} title="Conectar uma IDE" subtitle="Escolha a IDE, o projeto e o ambiente; o Córtex gera um token pessoal e a configuração pronta" />
      <div className="grid gap-5 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div className="space-y-4">
          <div>
            <div className="mb-1.5 text-xs font-medium text-text-muted">1. IDE</div>
            <div className="grid grid-cols-2 gap-2">
              {IDE_ORDER.map((id) => {
                const m = IDES[id];
                const Icon = m.icon;
                return (
                  <button
                    key={id}
                    onClick={() => {
                      setIde(id);
                      reset();
                    }}
                    aria-pressed={ide === id}
                    className={cx(
                      'flex items-center gap-2 rounded-field border px-3 py-2 text-left text-sm transition-colors',
                      ide === id ? 'border-primary bg-primary/5 shadow-halo-green' : 'border-border hover:border-accent',
                    )}
                  >
                    <Icon className="h-4 w-4 text-accent" strokeWidth={1.5} />
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="2. Projeto">
              <Select value={project} onChange={(e) => { setProject(e.target.value); reset(); }} options={projects.map((p) => ({ value: p, label: p }))} />
            </Field>
            <Field label="Ambiente">
              <Select value={env} onChange={(e) => { setEnv(e.target.value as EnvId); reset(); }} options={ENV_ORDER.map((e) => ({ value: e, label: `${ENVS[e].label} · ${ENVS[e].purpose}` }))} />
            </Field>
          </div>
          <Field label="Servidor MCP do Córtex">
            <Select value={url} onChange={(e) => { setUrl(e.target.value); setVerify('idle'); }} options={MCP_URLS} />
          </Field>
          <div>
            <div className="mb-1.5 text-xs font-medium text-text-muted">3. Token pessoal</div>
            {token ? (
              <div className="space-y-2 rounded-field border border-border bg-surface-2 p-3">
                <div className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4 shrink-0 text-primary" />
                  <Mono className="break-all text-text">{token}</Mono>
                </div>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  <dt className="text-text-muted">Pessoa</dt><dd>{user.name}</dd>
                  <dt className="text-text-muted">Validade</dt><dd>até {expires} (30 dias)</dd>
                  <dt className="text-text-muted">Escopo</dt>
                  <dd>
                    {ws.workspace.company} · <Mono>{project}</Mono> · {ENVS[env].label}
                  </dd>
                  <dt className="text-text-muted">Ferramentas</dt>
                  <dd>leitura{env === 'dev' ? ' e escrita' : ' e escrita (rascunho de jornada só em Dev)'}</dd>
                </dl>
                <Button size="sm" variant="ghost" icon={RefreshCw} onClick={generate}>Gerar de novo</Button>
              </div>
            ) : (
              <Button variant="secondary" icon={KeyRound} onClick={generate}>Gerar token pessoal</Button>
            )}
          </div>
        </div>

        <div className="min-w-0 space-y-3">
          <div className="text-xs font-medium text-text-muted">4. Configuração para {IDES[ide].label}</div>
          {!token ? (
            <div className="rounded-field border border-dashed border-border p-6 text-center text-sm text-text-muted">
              Gere o token para ver a configuração pronta para copiar.
            </div>
          ) : (
            <>
              {configs.length > 1 && (
                <Tabs value={String(cfgTab)} onChange={(v) => setCfgTab(Number(v))} tabs={configs.map((c, i) => ({ id: String(i), label: i === 0 ? 'Comando' : 'Variável de ambiente' }))} />
              )}
              <div className="text-xs text-text-muted">{configs[cfgTab]?.title}</div>
              <CodeBlock code={configs[cfgTab]?.code ?? ''} maxHeight={220} />
              <p className="text-[11px] text-text-muted">{configs[cfgTab]?.note}</p>
              {ide === 'claude_code' && (
                <div className="rounded-field border border-accent/40 bg-accent/5 p-3">
                  <div className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold">
                    <Package className="h-4 w-4 text-accent" /> Plugin do Córtex (opcional, recomendado)
                  </div>
                  <p className="mb-2 text-xs text-text-muted">
                    Leva o catálogo homologado como skills, subagentes, hooks e os comandos <Mono>/cortex:construir</Mono>, <Mono>/cortex:desenhar</Mono> e outros. Com o plugin, o <Mono>claude mcp add</Mono> não é necessário: o plugin já declara o servidor.
                  </p>
                  <div className="grid gap-2 md:grid-cols-2">
                    <div>
                      <div className="mb-1 text-[11px] text-text-muted">Dentro da sessão</div>
                      <CodeBlock code={PLUGIN_COMMANDS.session} maxHeight={120} />
                    </div>
                    <div>
                      <div className="mb-1 text-[11px] text-text-muted">Pelo terminal</div>
                      <CodeBlock code={PLUGIN_COMMANDS.terminal} maxHeight={120} />
                    </div>
                  </div>
                  <div className="mb-1 mt-2 text-[11px] text-text-muted">Defina antes de abrir o Claude Code</div>
                  <CodeBlock code={PLUGIN_COMMANDS.env(url, token)} maxHeight={160} />
                </div>
              )}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Button variant="primary" icon={verify === 'waiting' ? undefined : Radio} loading={verify === 'waiting'} onClick={() => void check()}>
                  Verificar conexão
                </Button>
                {verify === 'waiting' && (
                  <span className="flex items-center gap-1.5 text-sm text-text-muted">
                    <Loader2 className="h-4 w-4 animate-spin" /> Aguardando o primeiro contato da IDE…
                  </span>
                )}
              </div>
              {verify === 'ok' && (
                <div className="animate-fade-in rounded-field border border-primary/50 bg-primary/5 p-3 shadow-halo-green">
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-primary">
                    <CheckCircle2 className="h-4 w-4" /> Primeiro contato recebido
                  </div>
                  <p className="mt-0.5 text-xs text-text-muted">
                    {IDES[ide].label} chamou o <Term term="MCP">MCP</Term> com o token de {user.name} e reconheceu {recognized.length} ferramentas (demonstração).
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {recognized.map((t) => (
                      <Chip key={t} tone={WRITE_SET.has(t) ? 'purple' : 'green'}>
                        <span className="font-mono">{t}</span>
                      </Chip>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
