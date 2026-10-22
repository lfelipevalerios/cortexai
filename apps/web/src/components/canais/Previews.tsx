'use client';

import { useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from 'react';
import {
  AlertTriangle, ArrowLeft, Bot, CheckCheck, Headset, Mic, MoreVertical, Phone, PhoneOff, RotateCcw, Send, ShieldCheck, UserRound,
} from 'lucide-react';
import type { Channel, EnvId } from '@cortex/schemas';
import { ENVS } from '@cortex/schemas';
import { maskPii, relativeTime } from '@cortex/engine';
import { demoNow, useCortex, useWs } from '@/lib/store';
import { sleep } from '@/lib/tour-bus';
import { Button, Chip, CodeBlock, EmptyState, EnvBadge, Input, Mono, StatusChip, cx } from '@/components/ui';
import { TracePanel } from './TracePanel';
import { resolveTarget, useJourneyRun, type ChatMsg } from './useJourneyRun';
import { slugify } from './channelMeta';

export type SendFn = (text?: string, auto?: boolean) => Promise<void>;

export interface PreviewProps {
  channel: Channel;
  env: EnvId;
  sendRef: MutableRefObject<SendFn | null>;
}

/** Mensagem de exemplo: a persona da jornada vinculada. */
function usePersonaMessage(channel: Channel, env: EnvId): string {
  const ws = useWs();
  const jid = channel.journeyByEnv[env];
  return ws.journeys.find((j) => j.id === jid)?.persona.message ?? '';
}

/** Digita no campo como uma pessoa e envia (piloto automático) ou envia direto. */
function useSender(
  run: ReturnType<typeof useJourneyRun>,
  input: string,
  setInput: (s: string) => void,
  fallback: string,
  sendRef: MutableRefObject<SendFn | null>,
) {
  const inputRef = useRef(input);
  inputRef.current = input;
  const send: SendFn = async (text, auto) => {
    const t = (text ?? inputRef.current) || fallback;
    if (!t || run.running) return;
    if (auto) {
      setInput('');
      for (let i = 4; i < t.length + 4; i += 4) {
        setInput(t.slice(0, i));
        await sleep(18);
      }
      await sleep(350);
    }
    setInput('');
    await run.send(t);
  };
  sendRef.current = send;
  return send;
}

function NotLinked({ channel, env }: { channel: Channel; env: EnvId }) {
  return (
    <EmptyState
      title={`Sem jornada vinculada em ${ENVS[env].label}`}
      description={`Vincule uma jornada a "${channel.name}" neste ambiente (aba Vínculos) para conversar com ela no simulador.`}
    />
  );
}

// ---------- Bolhas ----------
function Bubbles({ messages, typing, botName, tone = 'whatsapp' }: { messages: ChatMsg[]; typing: boolean; botName: string; tone?: 'whatsapp' | 'web' }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [messages.length, typing]);
  return (
    <div className="space-y-2">
      {messages.map((m) =>
        m.from === 'sistema' ? (
          <div key={m.id} className="mx-auto max-w-[90%] rounded-field border border-danger/40 bg-danger/10 px-2.5 py-1.5 text-center text-[11px] text-danger">
            {m.text}
          </div>
        ) : (
          <div key={m.id} className={cx('flex animate-fade-in', m.from === 'cliente' ? 'justify-end' : 'justify-start')}>
            <div
              className={cx(
                'relative max-w-[82%] rounded-2xl px-3 py-2 text-[13px] leading-snug shadow-sm',
                m.from === 'cliente'
                  ? 'rounded-br-sm bg-accent/30 text-text'
                  : tone === 'whatsapp'
                    ? 'rounded-bl-sm border border-primary/25 bg-surface-1 text-text'
                    : 'rounded-bl-sm bg-surface-2 text-text',
              )}
            >
              {m.from === 'bot' && <div className="mb-0.5 text-[10px] font-semibold text-primary">{botName}</div>}
              <div className="whitespace-pre-wrap">{m.text}</div>
              {m.warn && (
                <div className="mt-1 flex items-center gap-1 text-[10px] font-medium text-danger">
                  <AlertTriangle className="h-3 w-3" /> {m.warn}
                </div>
              )}
              {m.masked && (
                <div className="mt-1 flex items-center gap-1 text-[10px] text-warning">
                  <ShieldCheck className="h-3 w-3" /> PII mascarada pelo filtro
                </div>
              )}
              <div className="mt-0.5 flex items-center justify-end gap-1 text-[10px] text-text-muted">
                {m.at}
                {m.from === 'cliente' && <CheckCheck className="h-3 w-3 text-primary-soft" />}
              </div>
            </div>
          </div>
        ),
      )}
      {typing && (
        <div className="flex justify-start">
          <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm border border-border bg-surface-1 px-3 py-2.5" aria-label="Digitando">
            {[0, 1, 2].map((i) => (
              <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-muted" style={{ animationDelay: `${i * 120}ms` }} />
            ))}
          </div>
        </div>
      )}
      <div ref={end} />
    </div>
  );
}

function Composer({ value, onChange, onSend, disabled, placeholder }: { value: string; onChange: (s: string) => void; onSend: () => void; disabled?: boolean; placeholder: string }) {
  return (
    <form
      className="flex items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSend();
      }}
    >
      <textarea
        aria-label="Mensagem"
        rows={2}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSend();
          }
        }}
        className="min-h-[40px] flex-1 resize-none rounded-2xl border border-border bg-surface-2 px-3 py-2 text-[13px] text-text placeholder:text-text-muted/70 focus:border-primary focus:outline-none"
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        aria-label="Enviar mensagem"
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary transition-colors hover:bg-primary-soft disabled:opacity-40"
      >
        <Send className="h-4 w-4" strokeWidth={2} />
      </button>
    </form>
  );
}

function PhoneFrame({ children, title, subtitle, avatar }: { children: ReactNode; title: string; subtitle: string; avatar: ReactNode }) {
  return (
    <div className="mx-auto w-[320px] shrink-0 rounded-[40px] border-[6px] border-surface-2 bg-bg p-1.5 shadow-halo-purple">
      <div className="relative flex h-[600px] flex-col overflow-hidden rounded-[30px] bg-surface-1">
        <div className="absolute left-1/2 top-1.5 z-10 h-4 w-24 -translate-x-1/2 rounded-full bg-bg" aria-hidden />
        <div className="flex items-center gap-2 border-b border-border bg-surface-2 px-3 pb-2 pt-7">
          <ArrowLeft className="h-4 w-4 text-text-muted" />
          {avatar}
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold">{title}</div>
            <div className="truncate text-[10px] text-primary-soft">{subtitle}</div>
          </div>
          <MoreVertical className="h-4 w-4 text-text-muted" />
        </div>
        {children}
      </div>
    </div>
  );
}

const chatBg = {
  backgroundImage:
    'radial-gradient(rgba(160,126,252,.10) 1px, transparent 1px), radial-gradient(rgba(0,255,149,.05) 1px, transparent 1px)',
  backgroundSize: '18px 18px, 18px 18px',
  backgroundPosition: '0 0, 9px 9px',
};

// ---------- WhatsApp e app: moldura de celular ----------
export function PhonePreview({ channel, env, sendRef }: PreviewProps) {
  const ws = useWs();
  const persona = usePersonaMessage(channel, env);
  const run = useJourneyRun(channel.id, env);
  const [input, setInput] = useState(persona);
  useEffect(() => setInput(persona), [persona, channel.id, env]);
  const send = useSender(run, input, setInput, persona, sendRef);
  const target = resolveTarget(channel.id, env);
  const isApp = channel.type === 'app';
  if (!target) return <NotLinked channel={channel} env={env} />;
  const typing = run.running;
  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <div>
        <PhoneFrame
          title={isApp ? `App ${ws.workspace.company}` : channel.name}
          subtitle={typing ? 'digitando…' : isApp ? 'assistente no app' : 'conta comercial · online'}
          avatar={
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-primary/50 bg-primary/10 text-primary">
              <Bot className="h-4 w-4" strokeWidth={1.5} />
            </span>
          }
        >
          <div className="min-h-0 flex-1 overflow-auto px-3 py-3" style={chatBg}>
            <div className="mb-3 text-center">
              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] text-text-muted">
                Hoje · {target.journey.name} <Mono className="text-[10px]">{target.version}</Mono>
              </span>
            </div>
            {run.messages.length === 0 && (
              <div className="mx-auto mb-2 max-w-[90%] rounded-field bg-warning/10 px-2.5 py-1.5 text-center text-[10px] text-warning">
                {isApp ? 'Conversa protegida pelo login do app.' : 'Mensagens com opt-in registrado. A conversa é atendida por uma jornada do Córtex.'}
              </div>
            )}
            <Bubbles messages={run.messages} typing={typing} botName={ws.workspace.company} />
          </div>
          <div className="border-t border-border bg-surface-2 p-2">
            <Composer value={input} onChange={setInput} onSend={() => void send()} disabled={run.running} placeholder="Mensagem" />
          </div>
        </PhoneFrame>
        <div className="mt-2 flex items-center justify-center gap-2 text-[11px] text-text-muted">
          <span>Cliente fictício: {target.journey.persona.name}</span>
          {run.messages.length > 0 && (
            <button className="inline-flex items-center gap-1 text-primary-soft hover:underline" onClick={() => { run.reset(); setInput(persona); }}>
              <RotateCcw className="h-3 w-3" /> Nova conversa
            </button>
          )}
        </div>
        {target.fallback && <FallbackNote env={env} version={target.version} />}
      </div>
      <TracePanel run={run} className="min-h-[420px] flex-1 lg:max-h-[640px]" />
    </div>
  );
}

function FallbackNote({ env, version }: { env: EnvId; version: string }) {
  return (
    <p className="mx-auto mt-2 max-w-[320px] text-center text-[11px] text-warning">
      A jornada não tem versão publicada em {ENVS[env].label}; o simulador usa a versão {version} de Dev.
    </p>
  );
}

// ---------- Web chat: widget sobre site fictício ----------
export function WebChatPreview({ channel, env, sendRef }: PreviewProps) {
  const ws = useWs();
  const persona = usePersonaMessage(channel, env);
  const run = useJourneyRun(channel.id, env);
  const [input, setInput] = useState(persona);
  const [open, setOpen] = useState(true);
  useEffect(() => setInput(persona), [persona, channel.id, env]);
  const send = useSender(run, input, setInput, persona, sendRef);
  const target = resolveTarget(channel.id, env);
  const color = channel.config.cor || '#A07EFC';
  const slug = slugify(ws.workspace.company);
  const embed = `<!-- Web chat do Córtex · ${channel.name} (${ENVS[env].label}) -->
<script
  src="https://cdn.cortex.exemplo.com/webchat/v1.js"
  data-canal="${channel.id}"
  data-ambiente="${env}"
  data-cor="${color}"
  data-boas-vindas="${channel.config.boasVindas ?? ''}"
  async></script>`;
  if (!target) return <NotLinked channel={channel} env={env} />;
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="relative min-h-[560px] flex-[1.4] overflow-hidden rounded-card border border-border bg-bg">
          <div className="flex items-center gap-2 border-b border-border bg-surface-2 px-3 py-2">
            <span className="flex gap-1">{['#FF7A9A', '#F9D718', '#00FF95'].map((c) => <span key={c} className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />)}</span>
            <span className="flex-1 truncate rounded-full bg-bg px-3 py-0.5 font-mono text-[11px] text-text-muted">https://www.{slug}.com.br</span>
          </div>
          <div className="space-y-4 p-6">
            <div className="flex items-center justify-between">
              <span className="text-base font-semibold">{ws.workspace.company}</span>
              <span className="hidden gap-4 text-xs text-text-muted sm:flex"><span>Produtos</span><span>Atendimento</span><span>Minha conta</span></span>
            </div>
            <div className="max-w-md">
              <div className="text-2xl font-semibold leading-tight">{ws.workspace.tagline}</div>
              <p className="mt-2 text-sm text-text-muted">{ws.workspace.description}</p>
            </div>
            <div className="grid max-w-md grid-cols-3 gap-2">
              {[0, 1, 2].map((i) => <div key={i} className="h-16 rounded-field border border-border bg-surface-1" />)}
            </div>
            <p className="text-[11px] text-text-muted">Site fictício para a demonstração.</p>
          </div>
          <div className="absolute bottom-4 right-4 flex flex-col items-end gap-2">
            {open && (
              <div className="flex h-[440px] w-[310px] flex-col overflow-hidden rounded-card border border-border bg-surface-1 shadow-2xl">
                <div className="flex items-center gap-2 px-3 py-2.5 text-on-primary" style={{ background: color }}>
                  <Bot className="h-4 w-4" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold">{ws.workspace.company}</div>
                    <div className="text-[10px] opacity-80">{run.running ? 'digitando…' : channel.config.horario ? `Atendimento ${channel.config.horario}` : 'online'}</div>
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-auto p-3">
                  <div className="mb-2 flex justify-start">
                    <div className="max-w-[82%] rounded-2xl rounded-bl-sm bg-surface-2 px-3 py-2 text-[13px]">{channel.config.boasVindas || 'Olá! Como posso ajudar?'}</div>
                  </div>
                  <Bubbles messages={run.messages} typing={run.running} botName={ws.workspace.company} tone="web" />
                </div>
                <div className="border-t border-border p-2">
                  <Composer value={input} onChange={setInput} onSend={() => void send()} disabled={run.running} placeholder="Escreva sua mensagem" />
                </div>
              </div>
            )}
            <button
              onClick={() => setOpen((o) => !o)}
              aria-label={open ? 'Minimizar chat' : 'Abrir chat'}
              className="inline-flex h-12 w-12 items-center justify-center rounded-full text-on-primary shadow-lg"
              style={{ background: color }}
            >
              <Bot className="h-5 w-5" />
            </button>
          </div>
        </div>
        <TracePanel run={run} className="min-h-[420px] flex-1 lg:max-h-[560px]" />
      </div>
      <div>
        <div className="mb-1.5 text-xs font-medium text-text-muted">Código para incorporar no site</div>
        <CodeBlock code={embed} maxHeight={200} />
      </div>
      {target.fallback && <FallbackNote env={env} version={target.version} />}
    </div>
  );
}

// ---------- Voz e URA: transcrição ----------
export function VoicePreview({ channel, env, sendRef }: PreviewProps) {
  const persona = usePersonaMessage(channel, env);
  const run = useJourneyRun(channel.id, env);
  const [input, setInput] = useState(persona);
  useEffect(() => setInput(persona), [persona, channel.id, env]);
  const send = useSender(run, input, setInput, persona, sendRef);
  const target = resolveTarget(channel.id, env);
  if (!target) return <NotLinked channel={channel} env={env} />;
  const inCall = run.messages.length > 0;
  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <div className="flex-[1.2] rounded-card border border-border bg-surface-2 p-4">
        <div className="flex items-center gap-3">
          <span className={cx('inline-flex h-11 w-11 items-center justify-center rounded-full border', inCall ? 'border-primary/60 bg-primary/10 text-primary animate-pulse-halo' : 'border-border text-text-muted')}>
            <Phone className="h-5 w-5" strokeWidth={1.5} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">{channel.name}</div>
            <div className="text-xs text-text-muted">{channel.config.numero ?? 'Número da URA'} · transcrição {channel.config.transcricao ?? 'em tempo real'}</div>
          </div>
          {inCall ? (
            <Button size="sm" variant="tertiary" icon={PhoneOff} onClick={() => { run.reset(); setInput(persona); }}>Encerrar</Button>
          ) : (
            <Chip tone="muted">Aguardando ligação</Chip>
          )}
        </div>
        <div className="mt-3 flex h-8 items-end gap-0.5" aria-hidden>
          {Array.from({ length: 48 }, (_, i) => (
            <span
              key={i}
              className={cx('w-1 rounded-full', run.running ? 'animate-pulse bg-primary/70' : 'bg-border')}
              style={{ height: `${20 + ((i * 37) % 80)}%`, animationDelay: `${(i % 6) * 90}ms` }}
            />
          ))}
        </div>
        <div className="mt-3 max-h-[300px] min-h-[180px] space-y-2 overflow-auto rounded-field border border-border bg-bg p-3 font-mono text-xs">
          {run.messages.length === 0 && <div className="text-text-muted">A transcrição aparece aqui em tempo real.</div>}
          {run.messages.map((m, i) => (
            <div key={m.id} className="animate-fade-in">
              <span className="text-text-muted">00:{String(4 + i * 9).padStart(2, '0')} </span>
              <span className={m.from === 'cliente' ? 'text-accent-soft' : m.from === 'bot' ? 'text-primary-soft' : 'text-danger'}>
                {m.from === 'cliente' ? 'Cliente' : 'URA'}:
              </span>{' '}
              <span className="text-text">{m.text}</span>
            </div>
          ))}
          {run.running && <div className="text-text-muted">URA: …</div>}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Mic className="h-4 w-4 shrink-0 text-text-muted" />
          <Input aria-label="Fala do cliente" value={input} onChange={(e) => setInput(e.target.value)} />
          <Button size="sm" variant="primary" icon={Phone} disabled={run.running || !input.trim()} onClick={() => void send()}>Falar</Button>
        </div>
        {target.fallback && <FallbackNote env={env} version={target.version} />}
      </div>
      <TracePanel run={run} className="min-h-[420px] flex-1 lg:max-h-[560px]" />
    </div>
  );
}

// ---------- API: JSON ----------
export function ApiPreview({ channel, env, sendRef }: PreviewProps) {
  const ws = useWs();
  const persona = usePersonaMessage(channel, env);
  const run = useJourneyRun(channel.id, env);
  const [input, setInput] = useState(persona);
  useEffect(() => setInput(persona), [persona, channel.id, env]);
  const send = useSender(run, input, setInput, persona, sendRef);
  const target = resolveTarget(channel.id, env);
  const [lastInput, setLastInput] = useState(persona);
  if (!target) return <NotLinked channel={channel} env={env} />;
  const host = `https://api.${slugify(ws.workspace.company)}.exemplo.com.br`;
  const path = (channel.config.endpoint || '/cortex/v1/canais/{id}/mensagens').replace('{id}', channel.id);
  const request = `POST ${host}${path}
Authorization: Bearer <token OAuth2 do sistema cliente>
Content-Type: application/json

${JSON.stringify({ ambiente: env, jornada: target.journey.id, mensagem: lastInput || input, contexto: { origem: 'sistema-parceiro' } }, null, 2)}`;
  const reply = run.messages.filter((m) => m.from !== 'cliente').slice(-1)[0];
  const exec = run.lastExecution;
  const response = exec
    ? `HTTP/1.1 200 OK
Content-Type: application/json

${JSON.stringify(
        {
          execucaoId: exec.id,
          resultado: exec.result,
          resposta: reply?.text ?? '',
          versaoJornada: target.version,
          tokens: exec.tokens,
          latenciaMs: exec.latencyMs,
          guardrail: exec.guardrail ?? null,
          passos: exec.steps.map((s) => ({ no: s.nodeId, status: s.status, latenciaMs: s.latencyMs })),
        },
        null,
        2,
      )}`
    : run.running
      ? '… aguardando resposta da jornada'
      : 'Envie a requisição para ver a resposta.';
  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <div className="min-w-0 flex-[1.3] space-y-3">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <div className="mb-1 text-xs font-medium text-text-muted">Mensagem no corpo da requisição</div>
            <Input value={input} onChange={(e) => setInput(e.target.value)} aria-label="Mensagem da requisição" />
          </div>
          <Button variant="primary" icon={Send} disabled={run.running || !input.trim()} onClick={() => { setLastInput(input); void send(); }}>
            Enviar requisição
          </Button>
        </div>
        <div>
          <div className="mb-1 text-xs font-medium text-text-muted">Requisição</div>
          <CodeBlock code={request} maxHeight={240} />
        </div>
        <div>
          <div className="mb-1 text-xs font-medium text-text-muted">Resposta</div>
          <CodeBlock code={response} maxHeight={300} />
        </div>
      </div>
      <TracePanel run={run} className="min-h-[420px] flex-1 lg:max-h-[640px]" />
    </div>
  );
}

// ---------- Backoffice: console do atendente ----------
interface QueueItem {
  id: string;
  cliente: string;
  motivo: string;
  espera: string;
  status: 'transbordo' | 'pendente' | 'ativo';
  resumo: string;
}

export function BackofficePreview({ channel, env, sendRef }: PreviewProps) {
  const ws = useWs();
  const toast = useCortex((s) => s.toast);
  const persona = usePersonaMessage(channel, env);
  const run = useJourneyRun(channel.id, env);
  const [input, setInput] = useState(persona);
  useEffect(() => setInput(persona), [persona, channel.id, env]);
  const send = useSender(run, input, setInput, persona, sendRef);
  const target = resolveTarget(channel.id, env);
  const linkedIds = new Set(Object.values(channel.journeyByEnv));
  const queue = useMemo<QueueItem[]>(() => {
    const now = demoNow();
    const fromExec = ws.executions
      .filter((e) => e.result === 'transbordo' && linkedIds.has(e.journeyId))
      .slice(0, 5)
      .map((e, i) => ({
        id: e.id,
        cliente: `Cliente ${String.fromCharCode(65 + i)}. ${['Souza', 'Lima', 'Prado', 'Costa', 'Melo'][i % 5]}`,
        motivo: ws.journeys.find((j) => j.id === e.journeyId)?.name ?? 'Atendimento',
        espera: relativeTime(e.at, now),
        status: 'transbordo' as const,
        resumo: maskPii(e.steps[e.steps.length - 1]?.output ?? 'Cliente pediu atendente.'),
      }));
    return fromExec.length
      ? fromExec
      : [{ id: 'fila-1', cliente: 'Cliente A. Souza', motivo: 'Pedido de atendente', espera: 'há 4 min', status: 'pendente', resumo: 'Cliente pediu para falar com uma pessoa.' }];
  }, [ws.executions, ws.journeys, channel.id]);
  const [selected, setSelected] = useState(0);
  const item = queue[Math.min(selected, queue.length - 1)];
  const suggestion = run.messages.filter((m) => m.from !== 'cliente').slice(-1)[0];
  if (!target) return <NotLinked channel={channel} env={env} />;
  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <div className="grid min-w-0 flex-[1.4] gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
        <div className="rounded-card border border-border bg-surface-2">
          <div className="flex items-center justify-between border-b border-border px-3 py-2 text-xs font-semibold">
            <span className="flex items-center gap-1.5"><Headset className="h-3.5 w-3.5 text-accent" /> Fila: {channel.config.fila ?? 'Atendimento'}</span>
            <Chip tone="yellow">{queue.length}</Chip>
          </div>
          <ul>
            {queue.map((q, i) => (
              <li key={q.id}>
                <button
                  onClick={() => setSelected(i)}
                  className={cx('w-full border-b border-border px-3 py-2 text-left hover:bg-surface-1', i === selected && 'bg-surface-1')}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate text-xs font-medium">{q.cliente}</span>
                    <StatusChip status={q.status} />
                  </div>
                  <div className="truncate text-[11px] text-text-muted">{q.motivo} · {q.espera}</div>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-card border border-border bg-surface-1 p-3">
          <div className="flex items-center gap-2">
            <UserRound className="h-5 w-5 text-text-muted" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{item.cliente}</div>
              <div className="text-[11px] text-text-muted">Transbordo da jornada · {item.motivo}</div>
            </div>
            <Button size="sm" variant="tertiary" onClick={() => toast({ kind: 'sucesso', title: 'Conversa assumida', description: `${item.cliente} agora está com você.` })}>Assumir</Button>
          </div>
          <div className="mt-3 rounded-field border border-border bg-surface-2 p-2.5 text-xs">
            <div className="mb-1 font-medium text-text-muted">Resumo entregue pelo agente</div>
            {item.resumo}
          </div>
          <div className="mt-3">
            <div className="mb-1 text-xs font-medium text-text-muted">Pergunta do cliente</div>
            <div className="flex gap-2">
              <Input value={input} onChange={(e) => setInput(e.target.value)} aria-label="Pergunta do cliente" />
              <Button size="sm" variant="secondary" icon={Bot} disabled={run.running || !input.trim()} onClick={() => void send()}>Sugerir resposta</Button>
            </div>
          </div>
          <div className={cx('mt-3 rounded-field border p-2.5 text-xs', suggestion ? 'border-primary/40 bg-primary/5' : 'border-dashed border-border')}>
            <div className="mb-1 flex items-center gap-1 font-medium text-primary"><Bot className="h-3.5 w-3.5" /> Sugestão do agente</div>
            {run.running ? 'Gerando sugestão…' : suggestion ? suggestion.text : 'A sugestão aparece aqui, gerada pela jornada vinculada.'}
            {suggestion && !run.running && (
              <div className="mt-2 flex gap-2">
                <Button size="sm" variant="primary" onClick={() => toast({ kind: 'sucesso', title: 'Sugestão enviada ao cliente' })}>Usar sugestão</Button>
                <Button size="sm" variant="ghost" onClick={() => toast({ kind: 'info', title: 'Sugestão descartada', description: 'O descarte vira sinal para as sugestões do cérebro.' })}>Descartar</Button>
              </div>
            )}
          </div>
        </div>
      </div>
      <TracePanel run={run} className="min-h-[420px] flex-1 lg:max-h-[600px]" />
    </div>
  );
}

/** Ambientes onde o canal tem jornada vinculada. */
export function linkedEnvs(channel: Channel): EnvId[] {
  return (['dev', 'hml', 'prd'] as EnvId[]).filter((e) => !!channel.journeyByEnv[e]);
}

export function EnvLinkLine({ channel, env }: { channel: Channel; env: EnvId }) {
  const ws = useWs();
  const jid = channel.journeyByEnv[env];
  const j = jid ? ws.journeys.find((x) => x.id === jid) : undefined;
  const v = j?.envVersions[env];
  return (
    <div className="flex items-center gap-2 text-xs">
      <EnvBadge env={env} />
      {j ? (
        <span className="min-w-0 truncate">
          {j.name} {v ? <Mono className="text-text-muted">{v}</Mono> : <span className="text-warning">(sem versão em {ENVS[env].label})</span>}
        </span>
      ) : (
        <span className="text-text-muted">sem jornada</span>
      )}
    </div>
  );
}

