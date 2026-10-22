'use client';

import { useCallback, useState } from 'react';
import type { ContractField, ContractVersion, DataContract, WorkspaceData } from '@cortex/schemas';
import {
  bumpVersion, diffContractFields, findBreakingConsumers, latestContractVersion, suggestBump,
  type BreakingConsumer, type BumpKind, type ContractDiff,
} from '@cortex/engine';
import { useCortex, demoNow } from '@/lib/store';
import { emitTourAction } from '@/lib/tour-bus';
import { BREAKING_FIELD } from '@cortex/seed';

export type EditorView = 'visual' | 'regras' | 'codigo' | 'versoes';

export type PublishState =
  | { kind: 'bloqueado'; consumers: BreakingConsumer[]; diff: ContractDiff; nextVersion: string; bump: BumpKind }
  | { kind: 'confirmar'; diff: ContractDiff; nextVersion: string; bump: BumpKind }
  | null;

export interface ContractEditor {
  contractId: string | null;
  contract: DataContract | null;
  latest: ContractVersion | null;
  draft: ContractField[] | null;
  /** Campos propostos (rascunho, ou a versão vigente se não houver rascunho). */
  fields: ContractField[];
  dirty: boolean;
  diff: ContractDiff | null;
  view: EditorView;
  publish: PublishState;
  setView: (v: EditorView) => void;
  open: (id: string | null) => void;
  removeField: (name: string) => void;
  restoreField: (name: string) => void;
  updateField: (name: string, patch: Partial<ContractField>) => void;
  addField: (f: ContractField) => boolean;
  discard: () => void;
  tryPublish: () => void;
  confirmPublish: (note: string, version: string) => void;
  closePublish: () => void;
}

/** Estado do editor de contratos (fica na página para o piloto automático alcançar). */
export function useContractEditor(ws: WorkspaceData): ContractEditor {
  const mutate = useCortex((s) => s.mutate);
  const replaceWorkspace = useCortex((s) => s.replaceWorkspace);
  const toast = useCortex((s) => s.toast);

  const [contractId, setContractId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ContractField[] | null>(null);
  const [view, setView] = useState<EditorView>('visual');
  const [publish, setPublish] = useState<PublishState>(null);

  const contract = ws.contracts.find((c) => c.id === contractId) ?? null;
  const latest = contract ? latestContractVersion(contract) ?? null : null;
  const fields = draft ?? latest?.fields ?? [];
  const diff = latest && draft ? diffContractFields(latest.fields, draft) : null;
  const dirty = !!diff && (diff.added.length > 0 || diff.removed.length > 0 || diff.changed.length > 0);

  const base = useCallback(() => {
    const st = useCortex.getState();
    const data = st.activeWorkspaceId ? st.workspaces[st.activeWorkspaceId] : null;
    const c = data?.contracts.find((x) => x.id === contractId);
    return c ? latestContractVersion(c)?.fields ?? [] : [];
  }, [contractId]);

  const breaking = BREAKING_FIELD[ws.workspace.industry];

  const open = useCallback((id: string | null) => {
    setContractId(id);
    setDraft(null);
    setPublish(null);
    setView('visual');
    if (id && id === breaking.contractId) emitTourAction('dados.abrir-contrato');
  }, [breaking.contractId]);

  const edit = (fn: (fs: ContractField[]) => ContractField[]) => {
    setDraft((d) => fn(d ?? base()));
    setPublish(null);
  };

  const removeField = (name: string) => {
    const prev = draft;
    edit((fs) => fs.filter((f) => f.name !== name));
    toast({
      kind: 'info',
      title: `Campo "${name}" removido do rascunho`,
      description: 'Nada foi publicado ainda.',
      undo: () => setDraft(prev),
    });
    if (contractId === breaking.contractId && name === breaking.field) emitTourAction('contrato.remover-campo-usado');
  };

  const restoreField = (name: string) => {
    const orig = base().find((f) => f.name === name);
    if (!orig) return;
    edit((fs) => {
      const order = base().map((f) => f.name);
      const next = [...fs.filter((f) => f.name !== name), orig];
      return next.sort((a, b) => {
        const ia = order.indexOf(a.name);
        const ib = order.indexOf(b.name);
        return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
      });
    });
  };

  const updateField = (name: string, patch: Partial<ContractField>) => edit((fs) => fs.map((f) => (f.name === name ? { ...f, ...patch } : f)));

  const addField = (f: ContractField) => {
    const name = f.name.trim();
    if (!name || fields.some((x) => x.name === name)) return false;
    edit((fs) => [...fs, { ...f, name }]);
    return true;
  };

  const discard = () => {
    const prev = draft;
    setDraft(null);
    setPublish(null);
    toast({ kind: 'info', title: 'Rascunho descartado', description: 'O contrato volta à versão publicada.', undo: () => setDraft(prev) });
  };

  const tryPublish = () => {
    if (!contract || !latest) return;
    const st = useCortex.getState();
    const data = st.activeWorkspaceId ? st.workspaces[st.activeWorkspaceId] : ws;
    const proposed = draft ?? latest.fields;
    const d = diffContractFields(latest.fields, proposed);
    const bump = suggestBump(d);
    const nextVersion = bumpVersion(latest.version, bump);
    emitTourAction('contrato.tentar-publicar');
    if (!d.added.length && !d.removed.length && !d.changed.length) {
      toast({ kind: 'info', title: 'Nada para publicar', description: 'O rascunho é igual à versão vigente.' });
      return;
    }
    const consumers = findBreakingConsumers(contract, proposed, data);
    if (consumers.length) {
      setPublish({ kind: 'bloqueado', consumers, diff: d, nextVersion, bump });
      toast({ kind: 'erro', title: 'Publicação bloqueada', description: `${consumers.length} jornada(s) em Prd usam o que mudou.` });
      return;
    }
    setPublish({ kind: 'confirmar', diff: d, nextVersion, bump });
  };

  const confirmPublish = (note: string, version: string) => {
    if (!contract || !latest || !draft) return;
    const st = useCortex.getState();
    const user = ws.users.find((u) => u.profile === st.profile);
    const before = mutate(
      (w) => {
        const c = w.contracts.find((x) => x.id === contract.id);
        if (!c) return;
        c.versions.push({
          ...latest,
          version,
          publishedAt: demoNow(),
          author: user?.name ?? 'Usuário da demo',
          note: note || `Versão ${version}`,
          fields: draft,
        });
        c.status = 'publicado';
      },
      { action: 'Publicou contrato de dados', object: `${contract.name} v${version}` },
    );
    setDraft(null);
    setPublish(null);
    toast({
      kind: 'sucesso',
      title: `${contract.name} v${version} publicado`,
      description: 'Variável tipada no Studio e recurso MCP atualizados.',
      undo: before ? () => replaceWorkspace(before) : undefined,
    });
  };

  return {
    contractId, contract, latest, draft, fields, dirty, diff, view, publish,
    setView, open, removeField, restoreField, updateField, addField, discard, tryPublish, confirmPublish,
    closePublish: () => setPublish(null),
  };
}
