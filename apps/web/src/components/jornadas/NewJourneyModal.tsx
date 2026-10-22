'use client';

// Nova jornada: a partir de um modelo da indústria ou "Descrever jornada" (/cortex:desenhar).
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, Workflow } from 'lucide-react';
import { DEMO_IDS } from '@cortex/seed';
import type { Journey } from '@cortex/schemas';
import { Button, Chip, CodeBlock, Field, Modal, NoPermission, Tabs, Textarea, cx } from '@/components/ui';
import { demoNow, useCortex, useProfile, useWs } from '@/lib/store';
import { sleep } from '@/lib/tour-bus';
import { cloneGraph, prefixOf, slugify, userName } from '@/components/studio/lib';

type Mode = 'modelo' | 'descrever';

export function NewJourneyModal({ canCreate, onClose }: { canCreate: boolean; onClose: () => void }) {
  const ws = useWs();
  const profile = useProfile();
  const mutate = useCortex((s) => s.mutate);
  const toast = useCortex((s) => s.toast);
  const router = useRouter();
  const anchorId = DEMO_IDS[ws.workspace.industry].anchorJourneyId;
  const [mode, setMode] = useState<Mode>('modelo');
  const [modelId, setModelId] = useState(anchorId);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const create = async () => {
    const model = ws.journeys.find((j) => j.id === (mode === 'modelo' ? modelId : anchorId)) ?? ws.journeys[0];
    if (!model) return;
    setBusy(true);
    if (mode === 'descrever') await sleep(1200);
    const latest = model.versions.find((v) => v.version === model.envVersions.dev) ?? model.versions[model.versions.length - 1];
    const name = mode === 'descrever' ? text.trim().replace(/\s+/g, ' ').slice(0, 70) : `${model.name} (cópia)`;
    const p = prefixOf(model.id);
    const ids = new Set(ws.journeys.map((j) => j.id));
    const base = `${p}-jr-${slugify(name, 28) || 'nova'}`;
    let id = base;
    for (let i = 2; ids.has(id); i++) id = `${base}-${i}`;
    const note = mode === 'descrever' ? `Rascunho gerado por /cortex:desenhar "${text.trim()}" (executado no Claude Code).` : `Criada a partir do modelo «${model.name}».`;
    const j: Journey = {
      id,
      name,
      description: mode === 'descrever' ? text.trim() : model.description,
      type: model.type,
      domainId: model.domainId,
      triggerLabel: model.triggerLabel,
      risk: model.risk,
      brainInputs: [...model.brainInputs],
      versions: [{ version: '0.1.0', createdAt: demoNow(), author: userName(ws, profile), note, graph: cloneGraph(latest.graph) }],
      envVersions: { dev: '0.1.0', hml: null, prd: null },
      persona: { ...model.persona },
      script: structuredClone(model.script),
      testCases: [],
      kpis: [...model.kpis],
    };
    mutate((d) => {
      d.journeys.push(j);
    }, { action: 'Criou jornada em rascunho', object: j.name });
    toast({ kind: 'sucesso', title: 'Rascunho criado em Dev', description: 'Ajuste o fluxo no Studio, teste com a persona e salve casos de teste.' });
    setBusy(false);
    onClose();
    router.push(`/jornadas/studio?id=${encodeURIComponent(id)}`);
  };

  const command = `/cortex:desenhar "${text.trim() || 'descreva o objetivo da jornada'}"`;

  return (
    <Modal
      open
      onClose={onClose}
      width={640}
      title="Nova jornada"
      subtitle="Comece de um modelo da indústria ou descreva o objetivo"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button
            variant="primary"
            icon={mode === 'descrever' ? Sparkles : Workflow}
            loading={busy}
            disabled={!canCreate || (mode === 'descrever' && text.trim().length < 8)}
            onClick={() => void create()}
          >
            {mode === 'descrever' ? 'Gerar rascunho' : 'Criar a partir do modelo'}
          </Button>
        </>
      }
    >
      {!canCreate && (
        <div className="mb-3">
          <NoPermission action="editar_jornada" />
        </div>
      )}
      <Tabs<Mode>
        value={mode}
        onChange={setMode}
        tabs={[
          { id: 'modelo', label: 'Modelo da indústria' },
          { id: 'descrever', label: 'Descrever jornada' },
        ]}
      />
      <div className="pt-4">
        {mode === 'modelo' ? (
          <ul className="space-y-2" role="radiogroup" aria-label="Modelos">
            {ws.journeys.map((j) => (
              <li key={j.id}>
                <label className={cx('flex cursor-pointer items-start gap-3 rounded-field border p-3', modelId === j.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-surface-2')}>
                  <input type="radio" name="modelo" checked={modelId === j.id} onChange={() => setModelId(j.id)} className="mt-1 accent-[#00FF95]" />
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      {j.name}
                      <Chip tone={j.type === 'agentica' ? 'purple' : 'lilac'}>{j.type === 'agentica' ? 'Agêntica' : 'Automação'}</Chip>
                    </span>
                    <span className="mt-0.5 block text-xs text-text-muted">{j.description}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        ) : (
          <div className="space-y-3">
            <Field label="Objetivo da jornada" hint="O rascunho usa o cérebro do workspace: regras, contratos, componentes homologados e canais.">
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Ex.: cliente PME pede a segunda via pelo WhatsApp e contesta cobranças indevidas"
                rows={3}
              />
            </Field>
            <div>
              <div className="mb-1 text-xs font-medium text-text-muted">Comando · executado no Claude Code</div>
              <CodeBlock code={command} maxHeight={90} />
              <p className="mt-1.5 text-xs text-text-muted">
                Na demonstração, o rascunho nasce como cópia do fluxo-modelo do workspace, em Dev, para ajuste visual no Studio.
              </p>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
