'use client';

import { Lightbulb, Wand2 } from 'lucide-react';
import type { Initiative, WorkspaceData } from '@cortex/schemas';
import { Button, Field, Input, Modal, NoPermission, Select, Textarea } from '@/components/ui';
import { TYPE_LABEL } from './shared';

export interface IdeaForm {
  title: string;
  problem: string;
  objective: string;
  metric: string;
  domainId: string;
  type: Initiative['type'];
  value: string;
}

export const EMPTY_FORM = (ws: WorkspaceData): IdeaForm => ({
  title: '', problem: '', objective: '', metric: '', domainId: ws.domains.find((d) => d.kind === 'negocio')?.id ?? ws.domains[0]?.id ?? '', type: 'nova_jornada', value: '',
});

export function NewInitiativeModal({ open, onClose, ws, form, setForm, onSubmit, onUseExample, allowed, busy }: {
  open: boolean;
  onClose: () => void;
  ws: WorkspaceData;
  form: IdeaForm;
  setForm: (f: IdeaForm) => void;
  onSubmit: () => void;
  onUseExample: () => void;
  allowed: boolean;
  busy: boolean;
}) {
  const valid = form.title.trim() && form.problem.trim() && form.objective.trim() && form.metric.trim();
  const set = <K extends keyof IdeaForm>(k: K, v: IdeaForm[K]) => setForm({ ...form, [k]: v });
  return (
    <Modal
      open={open}
      onClose={onClose}
      width={620}
      title={<span className="inline-flex items-center gap-2"><Lightbulb className="h-4 w-4 text-accent" strokeWidth={1.5} /> Nova iniciativa</span>}
      subtitle="Formulário curto: o cérebro liga a ideia aos objetivos da empresa ao registrar."
      footer={
        <>
          <Button variant="ghost" icon={Wand2} onClick={onUseExample} disabled={busy} className="mr-auto">Usar ideia de exemplo do setor</Button>
          <Button variant="tertiary" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={onSubmit} disabled={!valid || (!allowed && !busy)} loading={busy}>Registrar ideia</Button>
        </>
      }
    >
      <div className="space-y-3" data-tour={open ? 'iniciativa-nova' : undefined}>
        {!allowed && !busy && <NoPermission action="criar_iniciativa" />}
        <Field label="Título da ideia">
          <Input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Ex.: cliente resolve a dúvida de fatura pelo WhatsApp" />
        </Field>
        <Field label="Problema">
          <Textarea value={form.problem} onChange={(e) => set('problem', e.target.value)} placeholder="O que acontece hoje e quanto custa" className="min-h-[64px]" />
        </Field>
        <Field label="Objetivo">
          <Input value={form.objective} onChange={(e) => set('objective', e.target.value)} placeholder="O que muda para o cliente ou para a operação" />
        </Field>
        <Field label="Métrica de valor" hint="De quanto para quanto, para medir contra a linha de base.">
          <Input value={form.metric} onChange={(e) => set('metric', e.target.value)} placeholder="Ex.: resolução no primeiro contato de 58% para 75%" />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Área / domínio">
            <Select value={form.domainId} onChange={(e) => set('domainId', e.target.value)} options={ws.domains.map((d) => ({ value: d.id, label: d.name }))} />
          </Field>
          <Field label="Tipo">
            <Select value={form.type} onChange={(e) => set('type', e.target.value as Initiative['type'])} options={Object.entries(TYPE_LABEL).map(([value, label]) => ({ value, label }))} />
          </Field>
          <Field label="Valor esperado (R$/ano)">
            <Input inputMode="numeric" value={form.value} onChange={(e) => set('value', e.target.value.replace(/[^\d]/g, ''))} placeholder="Opcional" />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
