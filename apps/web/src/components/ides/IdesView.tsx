'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle, BookOpen, Download, FileCode2, Gauge, GitPullRequest, Hammer, Info, MessageSquareCode, PlugZap, ShieldCheck, Trash2, Wrench,
} from 'lucide-react';
import { ENVS, type BuildOrder, type IdeConnection } from '@cortex/schemas';
import { formatNumber, relativeTime } from '@cortex/engine';
import { SEED_TODAY } from '@cortex/seed';
import { demoNow, useCortex, useEnv, useWs } from '@/lib/store';
import {
  Button, Card, CardHeader, Chip, CodeBlock, EmptyState, EnvBadge, IconCircle, Modal, Mono, PageHeader, Progress, StatusChip, Table, Tabs, Term, cx,
} from '@/components/ui';
import { ConnectFlow } from './ConnectFlow';
import {
  IDES, MCP_PROMPTS, MCP_READ_TOOLS, MCP_RESOURCES, MCP_WRITE_TOOLS, OC_STATUS, WRITE_SET, exportAgentsMd, exportClaudeMd, exportCursorRules,
} from './mcp';

export function IdesView() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="IDEs & MCP"
        subtitle="O servidor MCP do Córtex leva o cérebro até o desenvolvedor: Claude Code, Cursor e outras IDEs agênticas recebem regras, contratos e componentes filtrados por perfil, projeto e ambiente."
      />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <ConnectedIdeCard />
        <McpExposure />
      </div>
      <ConnectFlow />
      <ConnectionsTable />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <CapacityPanel />
        <BuildOrdersQueue />
      </div>
      <ExportContext />
    </div>
  );
}

// ---------- IDE conectada (alvo do roteiro) ----------
function ConnectedIdeCard() {
  const ws = useWs();
  const now = demoNow();
  const conn = useMemo(() => [...ws.ideConnections].sort((a, b) => (a.lastCallAt < b.lastCallAt ? 1 : -1))[0], [ws.ideConnections]);
  if (!conn) {
    return (
      <Card data-tour="ides-conexao" className="p-4">
        <EmptyState icon={PlugZap} title="Nenhuma IDE conectada" description="Conecte o Claude Code ou outra IDE ao MCP do Córtex no passo a passo abaixo." />
      </Card>
    );
  }
  const m = IDES[conn.ide];
  const user = ws.users.find((u) => u.id === conn.userId);
  const oc = ws.buildOrders[0];
  return (
    <Card data-tour="ides-conexao" halo="green" className="flex flex-col">
      <CardHeader icon={PlugZap} title="IDE conectada ao MCP do Córtex" subtitle="Última conexão ativa do workspace" actions={<StatusChip status="conectado" />} />
      <div className="flex-1 space-y-4 p-4">
        <div className="flex items-center gap-3">
          <IconCircle icon={m.icon} tone="green" size="lg" />
          <div className="min-w-0">
            <div className="text-lg font-semibold">{m.label}</div>
            <div className="text-xs text-text-muted">
              {user?.name ?? conn.userId} · <Mono>{conn.project}</Mono> · <EnvBadge env={conn.env} />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <div className="text-[32px] font-semibold leading-none text-primary">{conn.tools.length}</div>
            <div className="mt-1 text-xs text-text-muted">ferramentas reconhecidas</div>
          </div>
          <div>
            <div className="text-xl font-semibold leading-tight">{relativeTime(conn.lastCallAt, now)}</div>
            <div className="mt-1 text-xs text-text-muted">última chamada</div>
          </div>
          <div>
            <div className="text-xl font-semibold leading-tight">{relativeTime(conn.connectedAt, now)}</div>
            <div className="mt-1 text-xs text-text-muted">conectada</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          {conn.tools.map((t) => (
            <Chip key={t} tone={WRITE_SET.has(t) ? 'purple' : 'green'}>
              <span className="font-mono">{t}</span>
            </Chip>
          ))}
        </div>
        {oc && (
          <div className="rounded-field border border-border bg-surface-2 p-3 text-xs text-text-muted">
            Trabalhando na <Term term="OC">OC</Term> <Mono className="text-text">{oc.id}</Mono> ({ws.journeys.find((j) => j.id === oc.journeyId)?.name}), executado no Claude Code com a licença de quem está logado.
          </div>
        )}
        <p className="flex items-start gap-1.5 text-[11px] text-text-muted">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          Governança na IDE: toda chamada ao MCP gera telemetria (quem, qual ferramenta, qual projeto e ambiente). <Mono>validar_contra_padroes</Mono> devolve violações com a regra de origem.
        </p>
      </div>
    </Card>
  );
}

// ---------- O que o servidor expõe ----------
type ExpoTab = 'ferramentas' | 'recursos' | 'prompts';

function McpExposure() {
  const ws = useWs();
  const [tab, setTab] = useState<ExpoTab>('ferramentas');
  return (
    <Card className="flex flex-col">
      <CardHeader icon={Wrench} title="O que o servidor MCP expõe" subtitle="Servidor real do protótipo (Streamable HTTP), lendo os mesmos dados desta tela" />
      <div className="px-4 pt-2">
        <Tabs<ExpoTab>
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'ferramentas', label: `Ferramentas (${MCP_READ_TOOLS.length + MCP_WRITE_TOOLS.length})` },
            { id: 'recursos', label: `Recursos (${MCP_RESOURCES.length})` },
            { id: 'prompts', label: `Prompts (${MCP_PROMPTS.length})` },
          ]}
        />
      </div>
      <div className="max-h-[420px] flex-1 overflow-auto p-4 text-sm">
        {tab === 'ferramentas' && (
          <div className="grid gap-4 md:grid-cols-2">
            {[
              { title: 'Leitura', tools: MCP_READ_TOOLS, tone: 'text-primary' },
              { title: 'Escrita', tools: MCP_WRITE_TOOLS, tone: 'text-accent' },
            ].map((g) => (
              <div key={g.title}>
                <div className={cx('mb-1.5 text-xs font-semibold uppercase tracking-wide', g.tone)}>{g.title}</div>
                <ul className="space-y-1.5">
                  {g.tools.map((t) => (
                    <li key={t.name}>
                      <Mono className="text-text">{t.name}</Mono>
                      <div className="text-[11px] text-text-muted">{t.title}</div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
        {tab === 'recursos' && (
          <div className="space-y-2">
            <p className="text-xs text-text-muted">
              Endereço <Mono>cortex://{ws.workspace.id}/&lt;tipo&gt;/&lt;id&gt;</Mono>, com índice em <Mono>cortex://{ws.workspace.id}/indice</Mono>.
            </p>
            <ul className="divide-y divide-border rounded-field border border-border">
              {MCP_RESOURCES.map((r) => (
                <li key={r.kind} className="flex items-center gap-3 px-3 py-2">
                  <BookOpen className="h-4 w-4 shrink-0 text-accent-soft" strokeWidth={1.5} />
                  <Mono className="w-24 shrink-0 text-text">{r.kind}</Mono>
                  <span className="min-w-0 flex-1 text-xs text-text-muted">{r.what}</span>
                  <Chip tone="muted">{r.format}</Chip>
                </li>
              ))}
            </ul>
          </div>
        )}
        {tab === 'prompts' && (
          <ul className="space-y-2">
            {MCP_PROMPTS.map((p) => (
              <li key={p.name} className="rounded-field border border-border p-3">
                <div className="flex items-center gap-2">
                  <MessageSquareCode className="h-4 w-4 text-accent" strokeWidth={1.5} />
                  <Mono className="text-text">{p.name}</Mono>
                </div>
                <div className="mt-1 text-xs text-text-muted">{p.title}</div>
                <div className="mt-1 flex gap-1">{p.args.map((a) => <Chip key={a} tone="lilac"><span className="font-mono">{a}</span></Chip>)}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

// ---------- Conexões existentes ----------
function ConnectionsTable() {
  const ws = useWs();
  const mutate = useCortex((s) => s.mutate);
  const replaceWorkspace = useCortex((s) => s.replaceWorkspace);
  const toast = useCortex((s) => s.toast);
  const [revoke, setRevoke] = useState<IdeConnection | null>(null);
  const now = demoNow();
  const userName = (id: string) => ws.users.find((u) => u.id === id)?.name ?? id;

  const confirmRevoke = () => {
    if (!revoke) return;
    const before = mutate((d) => {
      d.ideConnections = d.ideConnections.filter((c) => c.id !== revoke.id);
    }, { action: 'Revogou token de IDE', object: `${IDES[revoke.ide].label} · ${userName(revoke.userId)} · ${revoke.project}` });
    toast({ kind: 'aviso', title: 'Token revogado', description: `${IDES[revoke.ide].label} de ${userName(revoke.userId)} perdeu acesso ao MCP.`, undo: before ? () => replaceWorkspace(before) : undefined });
    setRevoke(null);
  };

  return (
    <Card>
      <CardHeader icon={PlugZap} title="Conexões de IDE" subtitle="Tokens pessoais ativos, com escopo de projeto e ambiente" />
      <div className="p-4">
        <Table<IdeConnection>
          rows={[...ws.ideConnections].sort((a, b) => (a.lastCallAt < b.lastCallAt ? 1 : -1))}
          rowKey={(c) => c.id}
          empty={<EmptyState icon={PlugZap} title="Nenhuma IDE conectada" description="Use o passo a passo acima para conectar a primeira IDE." />}
          columns={[
            { key: 'ide', header: 'IDE', render: (c) => <span className="flex items-center gap-2">{(() => { const I = IDES[c.ide].icon; return <I className="h-4 w-4 text-accent" strokeWidth={1.5} />; })()}{IDES[c.ide].label}</span> },
            { key: 'u', header: 'Pessoa', render: (c) => userName(c.userId) },
            { key: 'p', header: 'Projeto', render: (c) => <Mono>{c.project}</Mono> },
            { key: 'e', header: 'Ambiente', render: (c) => <EnvBadge env={c.env} /> },
            { key: 'c', header: 'Conectada', render: (c) => <span className="text-text-muted">{relativeTime(c.connectedAt, now)}</span> },
            { key: 'l', header: 'Última chamada', render: (c) => relativeTime(c.lastCallAt, now) },
            { key: 't', header: 'Ferramentas', render: (c) => <span title={c.tools.join(', ')}>{c.tools.length} ({c.tools.filter((t) => WRITE_SET.has(t)).length} de escrita)</span> },
          ]}
          actions={(c) => (
            <Button size="sm" variant="ghost" icon={Trash2} onClick={() => setRevoke(c)}>Revogar</Button>
          )}
        />
      </div>
      <Modal
        open={!!revoke}
        onClose={() => setRevoke(null)}
        title="Revogar token?"
        subtitle={revoke ? `${IDES[revoke.ide].label} · ${userName(revoke.userId)}` : undefined}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRevoke(null)}>Cancelar</Button>
            <Button variant="danger" icon={Trash2} onClick={confirmRevoke}>Revogar</Button>
          </>
        }
      >
        {revoke && (
          <ul className="list-disc space-y-1 pl-5 text-sm text-text-muted">
            <li>A IDE deixa de receber o contexto do projeto <Mono>{revoke.project}</Mono> em {ENVS[revoke.env].label}.</li>
            <li>OCs em andamento nessa IDE param de registrar progresso até um novo token.</li>
            <li>A revogação entra na auditoria. Dá para desfazer por alguns segundos.</li>
          </ul>
        )}
      </Modal>
    </Card>
  );
}

// ---------- Capacidade e licença ----------
function CapacityPanel() {
  const ws = useWs();
  const anchor = ws.journeys.find((j) => j.anchor) ?? ws.journeys[0];
  const nodes = anchor?.versions[anchor.versions.length - 1]?.graph.nodes.length ?? 6;
  const session = 58;
  const weekly = 37;
  const nextOc = Math.min(60, Math.round(nodes * 4.4));
  const near = session + nextOc > 85;
  const byPerson = useMemo(() => {
    const tokens = new Map<string, number>();
    ws.buildOrders.forEach((b) => {
      const conn = ws.ideConnections.find((c) => c.ide === 'claude_code') ?? ws.ideConnections[0];
      const who = conn?.userId ?? 'desconhecido';
      tokens.set(who, (tokens.get(who) ?? 0) + (b.tokens ?? 0));
    });
    ws.ideConnections.forEach((c, i) => {
      if (!tokens.has(c.userId)) tokens.set(c.userId, 38000 + i * 21500);
    });
    return [...tokens.entries()].map(([id, t]) => ({ name: ws.users.find((u) => u.id === id)?.name ?? id, tokens: t }));
  }, [ws.buildOrders, ws.ideConnections, ws.users]);

  return (
    <Card>
      <CardHeader icon={Gauge} title="Capacidade e licença" subtitle="Consumo vindo do OpenTelemetry do Claude Code, por OC e por pessoa (valores de demonstração)" />
      <div className="space-y-4 p-4">
        <div className="space-y-3">
          <div>
            <div className="mb-1 flex justify-between text-xs"><span>Janela de sessão de 5 h (Pro e Max)</span><span className="font-mono">{session}% · renova em 1 h 52 min</span></div>
            <Progress value={session} tone={session > 75 ? 'yellow' : 'green'} />
          </div>
          <div>
            <div className="mb-1 flex justify-between text-xs"><span>Limite semanal</span><span className="font-mono">{weekly}%</span></div>
            <Progress value={weekly} tone="purple" />
          </div>
          <p className="text-[11px] text-text-muted">Os dois limites são compartilhados com o app do Claude. Em Team e Enterprise, assentos premium têm mais uso e o administrador pode liberar créditos extras.</p>
        </div>
        {near && (
          <div className="flex items-start gap-2 rounded-field border border-warning/50 bg-warning/5 p-3 text-xs">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <div>
              <div className="font-semibold text-warning">OC grande perto do limite</div>
              <div className="text-text-muted">
                A próxima OC de {anchor?.name} deve usar cerca de {nextOc}% da janela. Divida por sub-fluxo ou aguarde a renovação antes de iniciar.
              </div>
            </div>
          </div>
        )}
        <div>
          <div className="mb-1.5 text-xs font-medium text-text-muted">Consumo por pessoa (7 dias)</div>
          <ul className="space-y-1 text-xs">
            {byPerson.map((p) => (
              <li key={p.name} className="flex justify-between"><span>{p.name}</span><Mono>{formatNumber(p.tokens)} tokens</Mono></li>
            ))}
          </ul>
        </div>
        <div className="space-y-2 rounded-field border border-danger/40 bg-danger/5 p-3 text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-danger"><AlertTriangle className="h-3.5 w-3.5" /> ANTHROPIC_API_KEY não pode estar definida</div>
          <p className="text-text-muted">Com ela definida, o Claude Code cobra pela API em vez de usar a licença. O modo <Mono>--bare</Mono> também não usa a licença e fica fora do protótipo. Confira e remova se aparecer algo:</p>
          <CodeBlock code={'echo $ANTHROPIC_API_KEY        # bash/zsh\necho $env:ANTHROPIC_API_KEY    # PowerShell'} maxHeight={80} />
        </div>
        <div className="flex items-start gap-2 rounded-field border border-primary/40 bg-primary/5 p-3 text-xs">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="text-text-muted">
            <span className="font-semibold text-text">O Córtex nunca pede, guarda ou repassa login do Claude.</span> A construção é executada no Claude Code oficial, sem modificação, logado com a licença de quem constrói. Automações sem pessoa usam chave de API do próprio cliente.
          </div>
        </div>
      </div>
    </Card>
  );
}

// ---------- Fila de ordens de construção ----------
function BuildOrdersQueue() {
  const ws = useWs();
  const now = demoNow();
  const orders = [...ws.buildOrders].sort((a, b) => {
    const rank = (o: BuildOrder) => ['em_construcao', 'plano_registrado', 'na_fila', 'pronta_revisao', 'concluida'].indexOf(o.status);
    return rank(a) - rank(b) || (a.createdAt < b.createdAt ? 1 : -1);
  });
  return (
    <Card>
      <CardHeader icon={Hammer} title="Fila de ordens de construção" subtitle="OCs priorizadas, executadas no Claude Code; o progresso volta pelo MCP" />
      <div className="space-y-2 p-4">
        {orders.length === 0 && (
          <EmptyState icon={Hammer} title="Nenhuma OC na fila" description='No Studio, "Enviar para construção" gera a OC com tudo o que o Claude Code precisa.' action={<Link href="/jornadas/studio"><Button size="sm" variant="primary">Abrir o Studio</Button></Link>} />
        )}
        {orders.map((o) => {
          const j = ws.journeys.find((x) => x.id === o.journeyId);
          const total = Object.keys(o.progress).length;
          const built = Object.values(o.progress).filter((p) => p === 'construido').length;
          const st = OC_STATUS[o.status];
          return (
            <div key={o.id} className={cx('rounded-field border bg-surface-1 p-3', o.status === 'em_construcao' ? 'border-primary/50 shadow-halo-green' : 'border-border')}>
              <div className="flex flex-wrap items-center gap-2">
                <Mono className="text-sm text-text">{o.id}</Mono>
                <StatusChip status={st.status} label={st.label} />
                <EnvBadge env={o.env} />
                <span className="ml-auto text-[11px] text-text-muted">criada {relativeTime(o.createdAt, now)}</span>
              </div>
              <div className="mt-1 text-sm">{j?.name ?? o.journeyId} <Mono className="text-text-muted">{o.journeyVersion}</Mono></div>
              <div className="mt-1 truncate font-mono text-[11px] text-text-muted">{o.repo} · {o.branch}</div>
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1"><Progress value={total ? (built / total) * 100 : 0} /></div>
                <span className="font-mono text-[11px] text-text-muted">{built}/{total} nós</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                {o.tokens !== undefined && <Chip tone="muted">{formatNumber(o.tokens)} tokens</Chip>}
                {o.evidences.length > 0 && <Chip tone="green">{o.evidences.length} evidências</Chip>}
                {o.prUrl && (
                  <a href={o.prUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary-soft hover:underline">
                    <GitPullRequest className="h-3.5 w-3.5" /> PR
                  </a>
                )}
                <Link href={`/jornadas/studio?id=${encodeURIComponent(o.journeyId)}`} className="ml-auto">
                  <Button size="sm" variant="tertiary">Ver no Studio</Button>
                </Link>
              </div>
            </div>
          );
        })}
        <p className="flex items-center gap-1.5 pt-1 text-[11px] text-text-muted">
          <Info className="h-3.5 w-3.5" /> Comando no terminal: <Mono>/cortex:construir {orders[0]?.id ?? '<OC>'}</Mono>
        </p>
      </div>
    </Card>
  );
}

// ---------- Exportar contexto como arquivos ----------
type FileTab = 'claude' | 'agents' | 'cursor';

function ExportContext() {
  const ws = useWs();
  const env = useEnv();
  const toast = useCortex((s) => s.toast);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<FileTab>('claude');
  const files: Record<FileTab, { path: string; content: string }> = useMemo(
    () => ({
      claude: { path: 'CLAUDE.md', content: exportClaudeMd(ws, env, SEED_TODAY) },
      agents: { path: 'AGENTS.md', content: exportAgentsMd(ws, env, SEED_TODAY) },
      cursor: { path: '.cursor/rules/cortex.mdc', content: exportCursorRules(ws, env) },
    }),
    [ws, env],
  );
  const download = () => {
    const f = files[tab];
    try {
      const blob = new Blob([f.content], { type: 'text/markdown;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = f.path.split('/').pop() ?? 'cortex.md';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch {
      toast({ kind: 'erro', title: 'Não foi possível baixar', description: 'Copie o conteúdo pelo botão Copiar.' });
    }
  };
  return (
    <Card>
      <CardHeader
        icon={FileCode2}
        title="Exportar contexto como arquivos"
        subtitle="Para times que preferem arquivos versionados no repositório: CLAUDE.md, AGENTS.md e regras do Cursor gerados do cérebro"
        actions={!open ? <Button size="sm" variant="secondary" icon={FileCode2} onClick={() => setOpen(true)}>Gerar arquivos</Button> : <Button size="sm" variant="tertiary" icon={Download} onClick={download}>Baixar {files[tab].path.split('/').pop()}</Button>}
      />
      {open ? (
        <div className="p-4">
          <Tabs<FileTab>
            value={tab}
            onChange={setTab}
            tabs={[
              { id: 'claude', label: 'CLAUDE.md' },
              { id: 'agents', label: 'AGENTS.md' },
              { id: 'cursor', label: '.cursor/rules' },
            ]}
          />
          <div className="mt-3 flex items-center gap-2 text-xs text-text-muted">
            <Mono className="text-text">{files[tab].path}</Mono> · gerado de regras, padrões, contratos e políticas de <EnvBadge env={env} />
          </div>
          <CodeBlock className="mt-2" code={files[tab].content} maxHeight={420} />
          <p className="mt-2 text-[11px] text-text-muted">Os arquivos são uma fotografia. O MCP continua sendo a fonte viva: quando uma regra muda no Córtex, a IDE conectada já recebe a versão nova.</p>
        </div>
      ) : (
        <div className="p-4 text-sm text-text-muted">Os arquivos são gerados a partir do ambiente ativo ({ENVS[env].label}).</div>
      )}
    </Card>
  );
}
