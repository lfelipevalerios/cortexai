'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Info, Lock, Pause, Play, Plug, Plus, Save, Trash2 } from 'lucide-react';
import { ENV_ORDER, ENVS, PROFILES, type Channel, type ChannelType, type EnvId } from '@cortex/schemas';
import { DEMO_IDS } from '@cortex/seed';
import { cortex, useCortex, useEnv, useProfile, useWs } from '@/lib/store';
import { emitTourAction, sleep, useAutoAction } from '@/lib/tour-bus';
import {
  Button, Card, CardHeader, Chip, EmptyState, EnvBadge, Field, IconCircle, Input, Modal, Mono, PageHeader, Select, StatusChip, Tabs, cx,
} from '@/components/ui';
import { CHANNEL_EDITORS, CHANNEL_META, CHANNEL_TYPES } from './channelMeta';
import { CanalWizard } from './CanalWizard';
import {
  ApiPreview, BackofficePreview, EnvLinkLine, PhonePreview, VoicePreview, WebChatPreview, linkedEnvs, type SendFn,
} from './Previews';

type DetailTab = 'previa' | 'config' | 'vinculos';

export function CanaisView() {
  const ws = useWs();
  const globalEnv = useEnv();
  const profile = useProfile();
  const router = useRouter();
  const params = useSearchParams();
  const mutate = useCortex((s) => s.mutate);
  const replaceWorkspace = useCortex((s) => s.replaceWorkspace);
  const toast = useCortex((s) => s.toast);
  const ids = DEMO_IDS[ws.workspace.industry];
  const whatsapp = ws.channels.find((c) => c.id === ids.whatsappChannelId) ?? ws.channels.find((c) => c.type === 'whatsapp');
  const anchor = ws.journeys.find((j) => j.id === ids.anchorJourneyId) ?? ws.journeys.find((j) => j.anchor);
  const canEdit = CHANNEL_EDITORS.includes(profile);

  const [selectedId, setSelectedId] = useState<string | null>(() => params.get('canal') ?? whatsapp?.id ?? ws.channels[0]?.id ?? null);
  const [tab, setTab] = useState<DetailTab>('previa');
  const [previewEnv, setPreviewEnv] = useState<EnvId | null>(null);
  const [wizard, setWizard] = useState<{ open: boolean; type?: ChannelType }>({ open: false });
  const [plugging, setPlugging] = useState(false);
  const sendRef = useRef<SendFn | null>(null);

  const selected = ws.channels.find((c) => c.id === selectedId) ?? null;

  const select = (id: string) => {
    setSelectedId(id);
    setPreviewEnv(null);
    router.replace(`/canais?canal=${encodeURIComponent(id)}`, { scroll: false });
  };

  // ---------- Plugar o WhatsApp na jornada-âncora ----------
  const plugWhatsapp = async (auto: boolean) => {
    const w = cortex.ws();
    if (!w) return;
    const ch = w.channels.find((c) => c.id === ids.whatsappChannelId) ?? w.channels.find((c) => c.type === 'whatsapp');
    const j = w.journeys.find((x) => x.id === ids.anchorJourneyId) ?? w.journeys.find((x) => x.anchor);
    if (!ch || !j) {
      toast({ kind: 'erro', title: 'Canal ou jornada não encontrados', description: 'Restaure a demo deste capítulo e tente de novo.' });
      return;
    }
    setSelectedId(ch.id);
    setPlugging(true);
    if (auto) {
      document.querySelector('[data-tour="canais-whatsapp"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await sleep(700);
    }
    const inHml = !!j.envVersions.hml;
    const before = mutate(
      (d) => {
        const c = d.channels.find((x) => x.id === ch.id);
        if (!c) return;
        c.journeyByEnv = { ...c.journeyByEnv, dev: j.id, ...(inHml ? { hml: j.id } : {}) };
        c.status = 'ativo';
      },
      { action: 'Plugou canal na jornada', object: `${ch.name} → ${j.name}${inHml ? ' (Dev e Hml)' : ' (Dev)'}` },
    );
    setPlugging(false);
    const undo = before ? () => replaceWorkspace(before) : undefined;
    if (inHml)
      toast({ kind: 'sucesso', title: 'WhatsApp plugado', description: `${j.name} atende no WhatsApp em Dev (${j.envVersions.dev}) e Hml (${j.envVersions.hml}), sem nova integração.`, undo });
    else
      toast({ kind: 'aviso', title: 'WhatsApp plugado em Dev', description: 'A jornada ainda não está em Hml. Promova no Studio e volte aqui para vincular Hml.', undo });
    setTab('previa');
    setPreviewEnv(inHml ? 'hml' : 'dev');
    emitTourAction('canal.plugar-whatsapp');
  };

  useAutoAction('canal.plugar-whatsapp', () => plugWhatsapp(true));

  useAutoAction('canal.enviar-mensagem', async () => {
    let w = cortex.ws();
    if (!w) return;
    let ch = w.channels.find((c) => c.id === ids.whatsappChannelId) ?? w.channels.find((c) => c.type === 'whatsapp');
    if (!ch) return;
    if (!linkedEnvs(ch).length) {
      await plugWhatsapp(true);
      await sleep(400);
      w = cortex.ws()!;
      ch = w.channels.find((c) => c.id === ch!.id)!;
    }
    const env: EnvId = previewEnv && ch.journeyByEnv[previewEnv] ? previewEnv : ch.journeyByEnv.hml ? 'hml' : linkedEnvs(ch)[0] ?? 'dev';
    setSelectedId(ch.id);
    setTab('previa');
    setPreviewEnv(env);
    await sleep(500);
    document.querySelector('[data-tour="canal-simulador"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await sleep(400);
    if (sendRef.current) await sendRef.current(undefined, true);
    else emitTourAction('canal.enviar-mensagem');
  });

  const missingTypes = CHANNEL_TYPES.filter((t) => !ws.channels.some((c) => c.type === t));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Canais"
        subtitle="Levam as jornadas até o cliente. O mesmo fluxo atende em qualquer canal, com uma jornada vinculada por ambiente."
        actions={
          <Button variant="primary" icon={Plus} disabled={!canEdit} title={canEdit ? undefined : 'Sem permissão neste perfil'} onClick={() => setWizard({ open: true })}>
            Cadastrar canal
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {ws.channels.map((c) => {
          const meta = CHANNEL_META[c.type];
          const isDemoWa = c.id === whatsapp?.id;
          const devOnly = isDemoWa && !!c.journeyByEnv.dev && !c.journeyByEnv.hml;
          const needsPlug = isDemoWa && anchor && (c.journeyByEnv.dev !== anchor.id || (!!anchor.envVersions.hml && c.journeyByEnv.hml !== anchor.id));
          return (
            <Card
              key={c.id}
              data-tour={isDemoWa ? 'canais-whatsapp' : undefined}
              halo={c.id === selectedId ? (isDemoWa ? 'green' : 'purple') : undefined}
              className="flex cursor-pointer flex-col p-4 transition-colors hover:border-accent"
              onClick={() => select(c.id)}
              role="button"
              tabIndex={0}
              aria-pressed={c.id === selectedId}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  select(c.id);
                }
              }}
            >
              <div className="flex items-start gap-3">
                <IconCircle icon={meta.icon} tone={c.status === 'ativo' ? 'green' : 'muted'} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold" title={c.name}>{c.name}</div>
                  <div className="text-xs text-text-muted">{meta.label}</div>
                </div>
                <StatusChip status={c.status} />
              </div>
              <div className="mt-3 space-y-1.5">
                {ENV_ORDER.map((e) => <EnvLinkLine key={e} channel={c} env={e} />)}
              </div>
              {devOnly && anchor && !anchor.envVersions.hml && (
                <p className="mt-2 flex items-start gap-1 text-[11px] text-warning">
                  <Info className="mt-0.5 h-3 w-3 shrink-0" /> Hml pendente: a jornada ainda não foi promovida para Hml.
                </p>
              )}
              {needsPlug && (
                <Button
                  size="sm"
                  variant="primary"
                  icon={Plug}
                  className="mt-3 self-start"
                  loading={plugging}
                  disabled={!canEdit}
                  onClick={(e) => {
                    e.stopPropagation();
                    void plugWhatsapp(false);
                  }}
                >
                  {c.journeyByEnv.dev === anchor?.id ? 'Vincular Hml também' : 'Plugar na jornada-âncora'}
                </Button>
              )}
            </Card>
          );
        })}
        {missingTypes.map((t) => {
          const meta = CHANNEL_META[t];
          return (
            <div key={t} className="flex flex-col rounded-card border border-dashed border-border p-4">
              <div className="flex items-start gap-3">
                <IconCircle icon={meta.icon} tone="muted" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">{meta.label}</div>
                  <div className="text-xs text-text-muted">{meta.description}</div>
                </div>
              </div>
              <div className="mt-auto flex items-center justify-between pt-3">
                <Chip tone="muted">Disponível para adicionar</Chip>
                <Button size="sm" variant="tertiary" icon={Plus} disabled={!canEdit} onClick={() => setWizard({ open: true, type: t })}>Adicionar</Button>
              </div>
            </div>
          );
        })}
      </div>

      {selected ? (
        <ChannelDetail
          key={selected.id}
          channel={selected}
          tab={tab}
          setTab={setTab}
          env={previewEnv && (selected.journeyByEnv[previewEnv] || !linkedEnvs(selected).length) ? previewEnv : selected.journeyByEnv[globalEnv] ? globalEnv : linkedEnvs(selected)[0] ?? globalEnv}
          setEnv={setPreviewEnv}
          sendRef={sendRef}
          canEdit={canEdit}
          onRemoved={() => setSelectedId(null)}
        />
      ) : (
        <EmptyState title="Escolha um canal" description="Clique em um cartão para ver a prévia interativa, a configuração e os vínculos por ambiente." />
      )}

      <CanalWizard open={wizard.open} initialType={wizard.type} onClose={() => setWizard({ open: false })} onCreated={(id) => select(id)} />
    </div>
  );
}

// ---------- Detalhe do canal ----------
function ChannelDetail({ channel, tab, setTab, env, setEnv, sendRef, canEdit, onRemoved }: {
  channel: Channel;
  tab: DetailTab;
  setTab: (t: DetailTab) => void;
  env: EnvId;
  setEnv: (e: EnvId) => void;
  sendRef: React.MutableRefObject<SendFn | null>;
  canEdit: boolean;
  onRemoved: () => void;
}) {
  const meta = CHANNEL_META[channel.type];
  const mutate = useCortex((s) => s.mutate);
  const replaceWorkspace = useCortex((s) => s.replaceWorkspace);
  const toast = useCortex((s) => s.toast);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const ws = useWs();

  const toggleStatus = () => {
    const next = channel.status === 'ativo' ? 'pausado' : 'ativo';
    const before = mutate((d) => {
      const c = d.channels.find((x) => x.id === channel.id);
      if (c) c.status = next;
    }, { action: next === 'ativo' ? 'Ativou canal' : 'Pausou canal', object: channel.name });
    toast({ kind: next === 'ativo' ? 'sucesso' : 'aviso', title: next === 'ativo' ? 'Canal ativado' : 'Canal pausado', description: channel.name, undo: before ? () => replaceWorkspace(before) : undefined });
  };

  const remove = () => {
    const before = mutate((d) => {
      d.channels = d.channels.filter((x) => x.id !== channel.id);
    }, { action: 'Removeu canal', object: channel.name });
    setConfirmRemove(false);
    onRemoved();
    toast({ kind: 'aviso', title: 'Canal removido', description: channel.name, undo: before ? () => replaceWorkspace(before) : undefined });
  };

  const linkedJourneys = Object.entries(channel.journeyByEnv)
    .map(([e, jid]) => `${ws.journeys.find((j) => j.id === jid)?.name ?? jid} (${ENVS[e as EnvId].label})`);

  return (
    <Card>
      <CardHeader
        icon={meta.icon}
        title={channel.name}
        subtitle={`${meta.label} · ${meta.previewLabel}`}
        actions={
          <>
            <StatusChip status={channel.status} />
            <Button size="sm" variant="tertiary" icon={channel.status === 'ativo' ? Pause : Play} disabled={!canEdit} onClick={toggleStatus}>
              {channel.status === 'ativo' ? 'Pausar' : 'Ativar'}
            </Button>
            <Button size="sm" variant="ghost" icon={Trash2} disabled={!canEdit} onClick={() => setConfirmRemove(true)}>Remover</Button>
          </>
        }
      />
      <div className="px-4 pt-2">
        <Tabs<DetailTab>
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'previa', label: 'Prévia interativa' },
            { id: 'config', label: 'Configuração' },
            { id: 'vinculos', label: 'Vínculos por ambiente' },
          ]}
        />
      </div>
      <div className="p-4">
        {tab === 'previa' && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-text-muted">Simular em</span>
              {ENV_ORDER.map((e) => {
                const linked = !!channel.journeyByEnv[e];
                return (
                  <button
                    key={e}
                    onClick={() => setEnv(e)}
                    disabled={!linked}
                    title={linked ? undefined : `Sem jornada vinculada em ${ENVS[e].label}`}
                    className={cx('rounded-full border px-1 py-0.5 transition-opacity disabled:cursor-not-allowed disabled:opacity-40', env === e ? 'border-primary' : 'border-transparent')}
                  >
                    <EnvBadge env={e} />
                  </button>
                );
              })}
              <span className="text-xs text-text-muted">A mensagem dispara a versão da jornada vinculada neste ambiente e gera uma execução na Telemetria.</span>
            </div>
            <div data-tour="canal-simulador">
              {meta.preview === 'phone' && <PhonePreview channel={channel} env={env} sendRef={sendRef} />}
              {meta.preview === 'webchat' && <WebChatPreview channel={channel} env={env} sendRef={sendRef} />}
              {meta.preview === 'voz' && <VoicePreview channel={channel} env={env} sendRef={sendRef} />}
              {meta.preview === 'api' && <ApiPreview channel={channel} env={env} sendRef={sendRef} />}
              {meta.preview === 'backoffice' && <BackofficePreview channel={channel} env={env} sendRef={sendRef} />}
              {meta.preview === 'form' && (
                <EmptyState
                  title={`${meta.previewLabel} chega na próxima versão`}
                  description="No protótipo, este canal tem configuração e vínculo por ambiente. A prévia interativa está em WhatsApp, App, Web chat, Voz, Backoffice e API."
                  action={<Button size="sm" variant="tertiary" onClick={() => setTab('config')}>Abrir configuração</Button>}
                />
              )}
            </div>
          </div>
        )}
        {tab === 'config' && <ChannelConfig channel={channel} canEdit={canEdit} />}
        {tab === 'vinculos' && <ChannelLinks channel={channel} canEdit={canEdit} />}
      </div>
      <Modal
        open={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        title="Remover canal?"
        subtitle={channel.name}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmRemove(false)}>Cancelar</Button>
            <Button variant="danger" icon={Trash2} onClick={remove}>Remover canal</Button>
          </>
        }
      >
        <div className="space-y-2 text-sm text-text-muted">
          <p>O canal deixa de atender imediatamente. Impacto:</p>
          <ul className="list-disc space-y-1 pl-5">
            {linkedJourneys.length ? linkedJourneys.map((l) => <li key={l}>Jornada desvinculada: {l}</li>) : <li>Nenhuma jornada vinculada.</li>}
            <li>O histórico de execuções continua na Telemetria.</li>
          </ul>
          <p>Você pode desfazer por alguns segundos após remover.</p>
        </div>
      </Modal>
    </Card>
  );
}

function EditLock() {
  const toast = useCortex((s) => s.toast);
  const who = CHANNEL_EDITORS.map((p) => PROFILES[p].label).join(', ');
  return (
    <div className="mb-3 flex items-start gap-3 rounded-card border border-warning/40 bg-warning/5 p-3">
      <Lock className="mt-0.5 h-4 w-4 shrink-0 text-warning" strokeWidth={1.5} />
      <div className="flex-1 text-sm">
        <div className="font-semibold">Configurar canais: sem permissão neste perfil</div>
        <div className="text-text-muted">Quem pode: {who}.</div>
      </div>
      <Button size="sm" variant="tertiary" onClick={() => toast({ kind: 'info', title: 'Pedido de acesso enviado', description: 'A solicitação entrou na fila de aprovações.' })}>Solicitar acesso</Button>
    </div>
  );
}

function ChannelConfig({ channel, canEdit }: { channel: Channel; canEdit: boolean }) {
  const meta = CHANNEL_META[channel.type];
  const mutate = useCortex((s) => s.mutate);
  const replaceWorkspace = useCortex((s) => s.replaceWorkspace);
  const toast = useCortex((s) => s.toast);
  const keys = [...meta.fields.map((f) => f.key), ...Object.keys(channel.config).filter((k) => !meta.fields.some((f) => f.key === k))];
  const [values, setValues] = useState<Record<string, string>>(channel.config);
  const [name, setName] = useState(channel.name);
  useEffect(() => {
    setValues(channel.config);
    setName(channel.name);
  }, [channel]);
  const dirty = name !== channel.name || keys.some((k) => (values[k] ?? '') !== (channel.config[k] ?? ''));
  const save = () => {
    const before = mutate((d) => {
      const c = d.channels.find((x) => x.id === channel.id);
      if (!c) return;
      c.name = name.trim() || c.name;
      c.config = Object.fromEntries(keys.filter((k) => values[k]?.trim()).map((k) => [k, values[k].trim()]));
    }, { action: 'Alterou configuração do canal', object: channel.name });
    toast({ kind: 'sucesso', title: 'Configuração salva', description: channel.name, undo: before ? () => replaceWorkspace(before) : undefined });
  };
  return (
    <div className="max-w-2xl">
      {!canEdit && <EditLock />}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome do canal">
          <Input value={name} disabled={!canEdit} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Identificador">
          <Input value={channel.id} disabled className="font-mono" />
        </Field>
        {keys.map((k) => {
          const f = meta.fields.find((x) => x.key === k);
          return (
            <Field key={k} label={f?.label ?? k} hint={f?.hint}>
              <Input value={values[k] ?? ''} placeholder={f?.placeholder} disabled={!canEdit} onChange={(e) => setValues((v) => ({ ...v, [k]: e.target.value }))} />
            </Field>
          );
        })}
      </div>
      <div className="mt-4 flex gap-2">
        <Button variant="primary" icon={Save} disabled={!canEdit || !dirty} onClick={save}>Salvar</Button>
        {dirty && <Button variant="ghost" onClick={() => { setValues(channel.config); setName(channel.name); }}>Descartar</Button>}
      </div>
    </div>
  );
}

function ChannelLinks({ channel, canEdit }: { channel: Channel; canEdit: boolean }) {
  const ws = useWs();
  const mutate = useCortex((s) => s.mutate);
  const replaceWorkspace = useCortex((s) => s.replaceWorkspace);
  const toast = useCortex((s) => s.toast);
  const [links, setLinks] = useState<Partial<Record<EnvId, string>>>(channel.journeyByEnv);
  useEffect(() => setLinks(channel.journeyByEnv), [channel.journeyByEnv]);
  const dirty = ENV_ORDER.some((e) => (links[e] ?? '') !== (channel.journeyByEnv[e] ?? ''));
  const save = () => {
    const clean = Object.fromEntries(Object.entries(links).filter(([, v]) => !!v)) as Partial<Record<EnvId, string>>;
    const before = mutate((d) => {
      const c = d.channels.find((x) => x.id === channel.id);
      if (!c) return;
      c.journeyByEnv = clean;
      if (Object.keys(clean).length && c.status === 'rascunho') c.status = 'ativo';
    }, { action: 'Alterou vínculos do canal', object: channel.name });
    toast({ kind: 'sucesso', title: 'Vínculos salvos', description: channel.name, undo: before ? () => replaceWorkspace(before) : undefined });
  };
  return (
    <div className="max-w-2xl space-y-3">
      {!canEdit && <EditLock />}
      <p className="text-sm text-text-muted">Cada ambiente pode atender uma jornada (e versão) diferente. A troca vale na hora para o canal daquele ambiente.</p>
      {ENV_ORDER.map((env) => {
        const options = ws.journeys.filter((j) => j.envVersions[env] || j.id === channel.journeyByEnv[env]);
        const j = ws.journeys.find((x) => x.id === links[env]);
        return (
          <div key={env} className="grid grid-cols-[56px_minmax(0,1fr)_120px] items-center gap-3">
            <EnvBadge env={env} />
            <Select
              aria-label={`Jornada em ${ENVS[env].label}`}
              value={links[env] ?? ''}
              disabled={!canEdit}
              onChange={(e) => setLinks((l) => ({ ...l, [env]: e.target.value }))}
              options={[{ value: '', label: 'Sem jornada' }, ...options.map((x) => ({ value: x.id, label: x.name }))]}
            />
            <span className="text-xs text-text-muted">
              {j ? (j.envVersions[env] ? <>versão <Mono>{j.envVersions[env]}</Mono></> : <span className="text-warning">sem versão aqui</span>) : '—'}
            </span>
          </div>
        );
      })}
      <Button variant="primary" icon={Save} disabled={!canEdit || !dirty} onClick={save}>Salvar vínculos</Button>
    </div>
  );
}
