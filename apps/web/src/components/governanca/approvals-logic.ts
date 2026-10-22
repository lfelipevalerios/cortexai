'use client';

import type { Approval, ProfileId } from '@cortex/schemas';
import { PROFILES } from '@cortex/schemas';
import { demoNow, useCortex } from '@/lib/store';
import { journeyIdFromObject } from './shared';

export type Decision = 'aprovado' | 'reprovado' | 'ajuste';

export const KIND_LABEL: Record<Approval['kind'], string> = {
  componente: 'Componente',
  contrato: 'Contrato',
  promocao: 'Promoção',
  acesso: 'Acesso',
};

const ACTION_LABEL: Record<Decision, Record<Approval['kind'], string>> = {
  aprovado: { componente: 'Aprovou componente', contrato: 'Aprovou contrato', promocao: 'Aprovou promoção para Prd', acesso: 'Concedeu acesso' },
  reprovado: { componente: 'Reprovou componente', contrato: 'Reprovou contrato', promocao: 'Reprovou promoção para Prd', acesso: 'Negou acesso' },
  ajuste: { componente: 'Pediu ajuste em componente', contrato: 'Pediu ajuste em contrato', promocao: 'Pediu ajuste na promoção', acesso: 'Pediu ajuste no pedido de acesso' },
};

export interface DecideResult {
  journeyId?: string;
}

/** Registra a decisão de uma aprovação (com auditoria e "Desfazer"). Fora de componentes também. */
export function decideApproval(approvalId: string, decision: Decision, note: string): DecideResult | null {
  const s = useCortex.getState();
  const wsId = s.activeWorkspaceId;
  if (!wsId) return null;
  const ap = s.workspaces[wsId].approvals.find((a) => a.id === approvalId);
  if (!ap) return null;
  if (s.profile !== ap.approverProfile) return null;
  const profile: ProfileId = s.profile;
  const actorName = s.workspaces[wsId].users.find((u) => u.profile === profile)?.name ?? PROFILES[profile].label;
  const journeyId = ap.kind === 'promocao' ? journeyIdFromObject(ap.objectId) : undefined;
  const before = s.mutate(
    (d) => {
      const x = d.approvals.find((a) => a.id === approvalId);
      if (!x) return;
      x.status = decision;
      const prefix = decision === 'aprovado' ? 'Aprovado' : decision === 'reprovado' ? 'Reprovado' : 'Ajuste pedido';
      x.comments = [...x.comments, { by: actorName, at: demoNow(), text: note.trim() ? `${prefix}: ${note.trim()}` : `${prefix}.` }];
      // Componente aprovado pelo CoE vira homologado no Catálogo.
      if (x.kind === 'componente' && decision === 'aprovado') {
        const c = d.components.find((cc) => cc.id === x.objectId);
        if (c && (c.status === 'em_revisao' || c.status === 'rascunho')) {
          c.status = 'homologado';
          c.approvals = [...c.approvals, { at: demoNow(), by: actorName, profile, decision: 'aprovado', note: note || undefined }];
        }
      }
      if (x.kind === 'contrato' && decision === 'aprovado') {
        const c = d.contracts.find((cc) => cc.id === x.objectId);
        if (c && c.status === 'rascunho') c.status = 'publicado';
      }
    },
    { action: ACTION_LABEL[decision][ap.kind], object: ap.title },
  );
  const journey = journeyId ? s.workspaces[wsId].journeys.find((j) => j.id === journeyId) : undefined;
  const undo = before ? () => useCortex.getState().replaceWorkspace(before) : undefined;
  if (decision === 'aprovado' && ap.kind === 'promocao') {
    s.toast({
      kind: 'sucesso',
      title: 'Promoção para Prd aprovada',
      description: `O gate de Prd de "${journey?.name ?? journeyId}" agora está satisfeito. Volte ao Studio: /jornadas/studio?id=${journeyId}`,
      undo,
    });
  } else {
    s.toast({
      kind: decision === 'aprovado' ? 'sucesso' : 'aviso',
      title: decision === 'aprovado' ? 'Pedido aprovado' : decision === 'reprovado' ? 'Pedido reprovado' : 'Ajuste pedido',
      description: ap.title,
      undo,
    });
  }
  return { journeyId };
}

/** Diff textual do pedido em "antes" e "depois" (linhas -, + e =). */
export function splitDiff(diff: string): { before: string; after: string } {
  const before: string[] = [];
  const after: string[] = [];
  for (const line of diff.split('\n')) {
    if (line.startsWith('-')) before.push(line.slice(1).trim());
    else if (line.startsWith('+')) after.push(line.slice(1).trim());
    else {
      const t = line.replace(/^=\s?/, '').trim();
      before.push(t);
      after.push(t);
    }
  }
  if (!diff.split('\n').some((l) => l.startsWith('-') || l.startsWith('+'))) return { before: '(versão publicada)', after: diff };
  return { before: before.join('\n'), after: after.join('\n') };
}
