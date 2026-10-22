import type { Initiative, InitiativeStage, Journey, Validation, WorkspaceData } from '@cortex/schemas';
import { INITIATIVE_STAGES } from '@cortex/schemas';
import { DEMO_IDS, scriptedPath } from '@cortex/seed';

export const TYPE_LABEL: Record<Initiative['type'], string> = {
  novo_produto: 'Novo produto',
  nova_jornada: 'Nova jornada',
  eficiencia: 'Eficiência',
  agente_ia: 'Agente de IA',
  modernizacao: 'Modernização',
};

export const SOLUTION_LABEL: Record<Validation['solutionType'], string> = {
  agente: 'Agente',
  automacao: 'Automação',
  aplicacao: 'Aplicação',
  integracao: 'Integração',
  produto_de_dados: 'Produto de dados',
};

export const HEALTH: Record<Initiative['health'], { status: string; label: string }> = {
  ok: { status: 'verde', label: 'Saudável' },
  atencao: { status: 'amarelo', label: 'Atenção' },
  risco: { status: 'vermelho', label: 'Em risco' },
};

export const STAGE_LABEL: Record<InitiativeStage, string> = Object.fromEntries(
  INITIATIVE_STAGES.map((s) => [s.id, s.label]),
) as Record<InitiativeStage, string>;

export const STAGE_ORDER: InitiativeStage[] = INITIATIVE_STAGES.map((s) => s.id);

/** O que o super harness entrega e a decisão humana em cada estágio (seção 11). */
export const STAGE_INFO: Record<InitiativeStage, { delivers: string; decision: string }> = {
  ideia: { delivers: 'Iniciativa registrada e ligada aos objetivos da empresa no cérebro', decision: 'Dono de negócio envia para validação' },
  validacao: { delivers: 'Relatório de validação com recomendação de seguir ou não', decision: 'Patrocinador decide seguir ou rever' },
  prototipo: { delivers: 'Especificação funcional, técnica e de experiência, mais protótipo navegável gerado pelo Claude Code', decision: 'Dono de negócio aprova a especificação' },
  construcao: { delivers: 'Rascunho da jornada no Studio, ordem de construção para o Claude Code e histórias no ITSM', decision: 'Champion AI conduz até Hml' },
  operacao: { delivers: 'KPIs da iniciativa ligados à telemetria e sugestões de melhoria', decision: 'Dono de negócio acompanha o valor' },
};

/** Camada de ofertas por estágio (visível só quando "mostrar ofertas" está ligado). */
export const STAGE_OFFERS: Record<InitiativeStage, string[]> = {
  ideia: ['AI Vision', 'AI Playbook'],
  validacao: ['AI Blueprint', 'AI Use Cases'],
  prototipo: ['Upstream agêntico'],
  construcao: ['Agentic Development', 'Agentic Test Automation'],
  operacao: ['Agentic Application Management'],
};

export function stageIndex(s: InitiativeStage) {
  return STAGE_ORDER.indexOf(s);
}

export function demoIds(ws: WorkspaceData) {
  return DEMO_IDS[ws.workspace.industry];
}

export function idPrefix(ws: WorkspaceData) {
  return demoIds(ws).anchorInitiativeId.split('-')[0];
}

export function domainName(ws: WorkspaceData, id?: string) {
  return ws.domains.find((d) => d.id === id)?.name ?? '—';
}

/**
 * Validação para iniciativas novas, montada com o que o workspace já tem no cérebro.
 * Recomendação sempre consultiva.
 */
export function buildValidation(ws: WorkspaceData, ini: Initiative): Validation {
  const domain = ws.domains.find((d) => d.id === ini.domainId);
  const contracts = ws.contracts.filter((c) => c.domainId === ini.domainId && c.status === 'publicado');
  const rules = ws.decisionTables.filter((t) => t.domainId === ini.domainId);
  const comps = ws.components.filter((c) => c.domainId === ini.domainId && (c.status === 'homologado' || c.status === 'publicado_prd'));
  const connected = ws.connectors.filter((c) => c.status === 'conectado').length;
  const degraded = ws.connectors.filter((c) => c.status === 'degradado' || c.status === 'erro');
  const reusePct = Math.min(80, 25 + comps.length * 10);
  const solutionType: Validation['solutionType'] = ini.type === 'agente_ia' || ini.type === 'nova_jornada' ? 'agente' : ini.type === 'eficiencia' ? 'automacao' : ini.type === 'novo_produto' ? 'aplicacao' : 'integracao';
  const gaps: string[] = [];
  if (!contracts.length) gaps.push(`Lacuna de dado: nenhum contrato publicado no domínio ${domain?.name ?? 'escolhido'}`);
  if (degraded.length) gaps.push(`Conector "${degraded[0].name}" com saúde degradada`);
  if (!rules.length) gaps.push('Sem regra de negócio estruturada para o domínio: definir a tabela de decisão antes da construção');
  return {
    checks: [
      { key: 'estrategia', label: 'Estratégia', result: 'verde', summary: `A métrica "${ini.metric || 'a definir'}" se liga aos objetivos vigentes da área ${domain?.name ?? ''}.`.replace(' .', '.'), source: 'Empresa · OKRs 2026' },
      { key: 'mercado', label: 'Mercado e regulação', result: 'verde', summary: 'Sem impedimento regulatório identificado nas fichas do setor.', source: 'Mercado · fichas do setor' },
      { key: 'regras', label: 'Regras de negócio', result: rules.length ? 'verde' : 'amarelo', summary: rules.length ? `Usa ${rules.map((r) => `"${r.name}"`).join(', ')} sem alterações.` : 'Nenhuma regra estruturada encontrada para o domínio.', source: 'Regras de negócio' },
      { key: 'dados', label: 'Dados', result: contracts.length ? 'verde' : 'amarelo', summary: contracts.length ? `Contratos disponíveis: ${contracts.map((c) => c.name).join(', ')}.` : 'Nenhum contrato publicado cobre a entidade principal.', source: 'Dados · contratos' },
      { key: 'integracoes', label: 'Integrações e canais', result: degraded.length ? 'amarelo' : 'verde', summary: `${connected} conectores ativos${degraded.length ? `; ${degraded.length} com saúde degradada` : ''}.`, source: 'Conectores e Canais' },
      { key: 'arquitetura', label: 'Arquitetura', result: 'verde', summary: `Padrão de referência sugerido para solução do tipo ${SOLUTION_LABEL[solutionType].toLowerCase()}.`, source: 'Arquitetura · arquitetura de referência' },
      { key: 'reuso', label: 'Reuso', result: reusePct >= 50 ? 'verde' : 'amarelo', summary: `${reusePct}% de reuso estimado${comps.length ? `: ${comps.slice(0, 3).map((c) => c.name).join(', ')}` : ''}.`, source: 'Catálogo' },
      { key: 'business_case', label: 'Business case', result: ini.expectedValueBRL > 0 ? 'verde' : 'amarelo', summary: ini.expectedValueBRL > 0 ? 'Valor esperado informado; premissas editáveis contra a linha de base.' : 'Valor esperado ainda não estimado.', source: 'Telemetria · linha de base' },
    ],
    recommendation: `O cérebro indica seguir com a iniciativa como ${SOLUTION_LABEL[solutionType].toLowerCase()}, reaproveitando os componentes homologados do domínio.${gaps.length ? ' Recomendamos avaliar os pontos de atenção antes da construção.' : ''}`,
    attention: gaps,
    reusePct,
    solutionType,
  };
}

/** Conversa do protótipo: mensagem da persona e resposta roteirizada da jornada. */
export function prototypeConversation(j: Journey | undefined): { persona: string; user: string; steps: string[]; reply: string } | null {
  if (!j) return null;
  const path = scriptedPath(j);
  const reply = [...path].reverse().find((n) => n.category === 'saida' && j.script[n.id]?.output);
  return {
    persona: j.persona.name,
    user: j.persona.message,
    steps: path.filter((n) => n.category !== 'gatilho' && n.category !== 'saida').map((n) => n.label),
    reply: reply ? j.script[reply.id].output : 'Entendi! Já estou cuidando disso e te aviso por aqui assim que concluir.',
  };
}
