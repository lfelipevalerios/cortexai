'use client';

import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { ENV_ORDER, ENVS, type Channel, type ChannelType, type EnvId } from '@cortex/schemas';
import { useCortex, useWs } from '@/lib/store';
import { Button, EnvBadge, Field, Input, Modal, Mono, Select, cx } from '@/components/ui';
import { CHANNEL_META, CHANNEL_TYPES, PREFIX, slugify } from './channelMeta';

const STEPS = ['Escolher o canal', 'Configurar', 'Vincular jornada por ambiente'];

export function CanalWizard({ open, initialType, onClose, onCreated }: {
  open: boolean;
  initialType?: ChannelType;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const ws = useWs();
  const mutate = useCortex((s) => s.mutate);
  const replaceWorkspace = useCortex((s) => s.replaceWorkspace);
  const toast = useCortex((s) => s.toast);
  const [step, setStep] = useState(0);
  const [type, setType] = useState<ChannelType | null>(initialType ?? null);
  const [name, setName] = useState('');
  const [config, setConfig] = useState<Record<string, string>>({});
  const [links, setLinks] = useState<Partial<Record<EnvId, string>>>({});

  useEffect(() => {
    if (!open) return;
    setStep(initialType ? 1 : 0);
    setType(initialType ?? null);
    setName(initialType ? `${CHANNEL_META[initialType].label} ${ws.workspace.company}` : '');
    setConfig({});
    setLinks({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialType]);

  const meta = type ? CHANNEL_META[type] : null;
  const canNext = step === 0 ? !!type : step === 1 ? name.trim().length > 1 : true;

  const choose = (t: ChannelType) => {
    setType(t);
    setName(`${CHANNEL_META[t].label} ${ws.workspace.company}`);
    setConfig({});
  };

  const finish = () => {
    if (!type || !meta) return;
    const base = `${PREFIX[ws.workspace.industry]}-ch-${slugify(type)}`;
    let id = base;
    for (let i = 2; ws.channels.some((c) => c.id === id); i++) id = `${base}-${i}`;
    const filled = Object.fromEntries(meta.fields.map((f) => [f.key, config[f.key]?.trim() || f.placeholder]));
    const journeyByEnv = Object.fromEntries(Object.entries(links).filter(([, v]) => !!v)) as Partial<Record<EnvId, string>>;
    const channel: Channel = {
      id,
      type,
      name: name.trim(),
      status: Object.keys(journeyByEnv).length ? 'ativo' : 'rascunho',
      config: filled,
      journeyByEnv,
    };
    const before = mutate((d) => {
      d.channels.push(channel);
    }, { action: 'Cadastrou canal', object: channel.name });
    toast({
      kind: 'sucesso',
      title: 'Canal cadastrado',
      description: Object.keys(journeyByEnv).length
        ? `${channel.name} está ativo em ${Object.keys(journeyByEnv).map((e) => ENVS[e as EnvId].label).join(', ')}.`
        : `${channel.name} ficou como rascunho até receber uma jornada.`,
      undo: before ? () => replaceWorkspace(before) : undefined,
    });
    onCreated(id);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={920}
      title="Cadastrar canal"
      subtitle="Três passos: escolher, configurar e vincular uma jornada por ambiente"
      footer={
        <>
          {step > 0 && <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>Voltar</Button>}
          {step < 2 ? (
            <Button variant="primary" disabled={!canNext} onClick={() => setStep((s) => s + 1)}>Próximo</Button>
          ) : (
            <Button variant="primary" icon={Check} onClick={finish}>Concluir</Button>
          )}
        </>
      }
    >
      <div className="grid gap-5 md:grid-cols-[180px_minmax(0,1fr)_200px]">
        <ol className="space-y-2">
          {STEPS.map((s, i) => (
            <li key={s} className={cx('flex items-center gap-2 text-sm', i === step ? 'text-text' : 'text-text-muted')}>
              <span
                className={cx(
                  'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs',
                  i < step ? 'border-primary bg-primary text-on-primary' : i === step ? 'border-primary text-primary' : 'border-border',
                )}
              >
                {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              {s}
            </li>
          ))}
        </ol>

        <div className="min-w-0">
          {step === 0 && (
            <div className="grid gap-2 sm:grid-cols-2">
              {CHANNEL_TYPES.map((t) => {
                const m = CHANNEL_META[t];
                const Icon = m.icon;
                return (
                  <button
                    key={t}
                    onClick={() => choose(t)}
                    className={cx(
                      'flex items-start gap-2 rounded-field border p-3 text-left transition-colors',
                      type === t ? 'border-primary bg-primary/5 shadow-halo-green' : 'border-border hover:border-accent',
                    )}
                  >
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-accent" strokeWidth={1.5} />
                    <span>
                      <span className="block text-sm font-medium">{m.label}</span>
                      <span className="block text-xs text-text-muted">{m.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          {step === 1 && meta && (
            <div className="space-y-3">
              <Field label="Nome do canal">
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              {meta.fields.map((f) => (
                <Field key={f.key} label={f.label} hint={f.hint}>
                  <Input
                    value={config[f.key] ?? ''}
                    placeholder={f.placeholder}
                    onChange={(e) => setConfig((c) => ({ ...c, [f.key]: e.target.value }))}
                  />
                </Field>
              ))}
              <p className="text-xs text-text-muted">Campos vazios usam o valor sugerido. Segredos ficam no cofre; aqui só entram referências.</p>
            </div>
          )}
          {step === 2 && (
            <div className="space-y-3">
              <p className="text-sm text-text-muted">O mesmo canal pode atender versões diferentes em cada ambiente. Só aparecem jornadas com versão publicada no ambiente.</p>
              {ENV_ORDER.map((env) => {
                const options = ws.journeys.filter((j) => j.envVersions[env]);
                return (
                  <div key={env} className="grid grid-cols-[56px_minmax(0,1fr)] items-center gap-3">
                    <EnvBadge env={env} />
                    <Select
                      aria-label={`Jornada em ${ENVS[env].label}`}
                      value={links[env] ?? ''}
                      onChange={(e) => setLinks((l) => ({ ...l, [env]: e.target.value }))}
                      options={[
                        { value: '', label: options.length ? 'Sem jornada' : `Nenhuma jornada em ${ENVS[env].label}` },
                        ...options.map((j) => ({ value: j.id, label: `${j.name} · ${j.envVersions[env]}` })),
                      ]}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <aside className="rounded-field border border-border bg-surface-2 p-3 text-xs">
          <div className="mb-2 font-semibold">Resumo</div>
          <dl className="space-y-1.5">
            <div><dt className="text-text-muted">Canal</dt><dd>{meta?.label ?? '—'}</dd></div>
            <div><dt className="text-text-muted">Nome</dt><dd className="break-words">{name || '—'}</dd></div>
            <div><dt className="text-text-muted">Prévia</dt><dd>{meta?.previewLabel ?? '—'}</dd></div>
            <div>
              <dt className="text-text-muted">Jornadas</dt>
              <dd className="space-y-1">
                {ENV_ORDER.map((e) => {
                  const j = ws.journeys.find((x) => x.id === links[e]);
                  return (
                    <div key={e} className="flex items-center gap-1">
                      <EnvBadge env={e} /> {j ? <span className="truncate">{j.name}</span> : <Mono className="text-text-muted">—</Mono>}
                    </div>
                  );
                })}
              </dd>
            </div>
          </dl>
        </aside>
      </div>
    </Modal>
  );
}
