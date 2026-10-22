// Gerador determinístico dos 4 workspaces da demo do Córtex.
import type { ConnectorTool, DiscoveredObject, IndustryId, WorkspaceData } from '@cortex/schemas';
import { assemble, makeCtx, type Ctx, type IndustryContent, type IndustryMeta } from './common';
import * as saude from './industries/saude';
import * as varejo from './industries/varejo';
import * as financeiro from './industries/financeiro';
import * as telecom from './industries/telecom';

export { CONNECTOR_TYPES } from './connectors';
export { SEED_TODAY, scriptedPath } from './common';

interface IndustryModule {
  meta: IndustryMeta;
  DEMO: DemoIds;
  BREAKING: { contractId: string; field: string };
  crmPreset: (ctx: Ctx) => CrmPreset;
  build: (ctx: Ctx) => IndustryContent;
}

export interface CrmPreset {
  typeId: string;
  name: string;
  endpoint: string;
  objects: DiscoveredObject[];
  tools: ConnectorTool[];
  domainId: string;
}

export interface DemoIds {
  anchorJourneyId: string;
  prdJourneyId: string;
  anchorInitiativeId: string;
  whatsappChannelId: string;
  showcaseDecisionTableId: string;
  showcaseQuestion: string;
  crmSystemId: string;
}

const MODULES: IndustryModule[] = [saude, varejo, financeiro, telecom];

/** Gera os 4 workspaces (saúde, varejo, financeiro, telecom). Mesma saída a cada chamada. */
export function generateWorkspaces(): WorkspaceData[] {
  return MODULES.map((m) => {
    const ctx = makeCtx(m.meta);
    return assemble(ctx, m.build(ctx));
  });
}

export function getWorkspace(id: string): WorkspaceData | undefined {
  const m = MODULES.find((x) => x.meta.ws === id);
  if (!m) return undefined;
  const ctx = makeCtx(m.meta);
  return assemble(ctx, m.build(ctx));
}

/** Pré-preenchimento do wizard de conectores (capítulo 2): o CRM de cada workspace. */
export const CRM_WIZARD_PRESET: Record<IndustryId, CrmPreset> = Object.fromEntries(
  MODULES.map((m) => [m.meta.industry, m.crmPreset(makeCtx({ ...m.meta, seed: m.meta.seed + 7 }))]),
) as Record<IndustryId, CrmPreset>;

/** Campo de contrato usado por jornada em Prd: removê-lo deve bloquear a publicação. */
export const BREAKING_FIELD: Record<IndustryId, { contractId: string; field: string }> = {
  saude: saude.BREAKING,
  varejo: varejo.BREAKING,
  financeiro: financeiro.BREAKING,
  telecom: telecom.BREAKING,
};

/** Objetos-chave da demo para a UI e o roteiro guiado. */
export const DEMO_IDS: Record<IndustryId, DemoIds> = {
  saude: saude.DEMO,
  varejo: varejo.DEMO,
  financeiro: financeiro.DEMO,
  telecom: telecom.DEMO,
};
