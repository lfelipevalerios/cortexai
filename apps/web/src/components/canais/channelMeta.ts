import {
  Bot, Braces, Globe, Headset, Mail, MessageCircle, MessagesSquare, Phone, Smartphone, type LucideIcon,
} from 'lucide-react';
import type { ChannelType, IndustryId, ProfileId } from '@cortex/schemas';

export type PreviewKind = 'phone' | 'webchat' | 'voz' | 'backoffice' | 'api' | 'form';

export interface ChannelField {
  key: string;
  label: string;
  placeholder: string;
  hint?: string;
}

export interface ChannelMeta {
  label: string;
  icon: LucideIcon;
  description: string;
  preview: PreviewKind;
  previewLabel: string;
  fields: ChannelField[];
}

export const CHANNEL_TYPES: ChannelType[] = ['whatsapp', 'webchat', 'app', 'voz', 'backoffice', 'api', 'email', 'teams', 'agentes'];

export const CHANNEL_META: Record<ChannelType, ChannelMeta> = {
  whatsapp: {
    label: 'WhatsApp Business',
    icon: MessageCircle,
    description: 'Número, templates aprovados e opt-in do cliente.',
    preview: 'phone',
    previewLabel: 'Simulador de conversa em moldura de celular',
    fields: [
      { key: 'numero', label: 'Número', placeholder: '+55 11 4000-0000' },
      { key: 'templates', label: 'Templates aprovados', placeholder: 'boas_vindas, protocolo_atendimento' },
      { key: 'optin', label: 'Opt-in', placeholder: 'obrigatório no primeiro contato' },
      { key: 'horario', label: 'Horário', placeholder: '24 horas' },
    ],
  },
  webchat: {
    label: 'Web chat',
    icon: Globe,
    description: 'Widget no site: cores, boas-vindas, horário e código para incorporar.',
    preview: 'webchat',
    previewLabel: 'Widget ao vivo sobre um site fictício da empresa',
    fields: [
      { key: 'cor', label: 'Cor do widget', placeholder: '#A07EFC' },
      { key: 'boasVindas', label: 'Mensagem de boas-vindas', placeholder: 'Olá! Como posso ajudar?' },
      { key: 'horario', label: 'Horário', placeholder: '24 horas' },
    ],
  },
  app: {
    label: 'App mobile',
    icon: Smartphone,
    description: 'SDK com chave por ambiente para o app da empresa.',
    preview: 'phone',
    previewLabel: 'Tela de app em moldura de celular',
    fields: [
      { key: 'sdk', label: 'SDK', placeholder: 'iOS e Android (React Native)' },
      { key: 'chave', label: 'Chave por ambiente', placeholder: 'cofre://canais/app/<ambiente>', hint: 'Referência no cofre; a chave nunca aparece na tela.' },
    ],
  },
  voz: {
    label: 'Voz e URA',
    icon: Phone,
    description: 'Fluxo de entrada e transcrição em tempo real.',
    preview: 'voz',
    previewLabel: 'Transcrição em tempo real no simulador',
    fields: [
      { key: 'numero', label: 'Número', placeholder: '0800 000 0000' },
      { key: 'transcricao', label: 'Transcrição', placeholder: 'tempo real' },
      { key: 'menu', label: 'Fluxo de entrada', placeholder: 'opção 1 → jornada de atendimento' },
    ],
  },
  backoffice: {
    label: 'Backoffice',
    icon: Headset,
    description: 'Painel do atendente com sugestões do agente.',
    preview: 'backoffice',
    previewLabel: 'Tela do atendente com fila e transbordos',
    fields: [
      { key: 'fila', label: 'Fila', placeholder: 'Atendimento geral' },
      { key: 'sugestoes', label: 'Sugestões do agente', placeholder: 'ativadas' },
    ],
  },
  api: {
    label: 'API',
    icon: Braces,
    description: 'Endpoint headless para outros sistemas.',
    preview: 'api',
    previewLabel: 'Chamada e resposta em JSON',
    fields: [
      { key: 'endpoint', label: 'Endpoint', placeholder: '/cortex/v1/canais/{id}/mensagens' },
      { key: 'autenticacao', label: 'Autenticação', placeholder: 'OAuth2 client credentials' },
      { key: 'limite', label: 'Limite de chamadas', placeholder: '600 por minuto' },
    ],
  },
  email: {
    label: 'E-mail',
    icon: Mail,
    description: 'Caixa de entrada monitorada e assinatura.',
    preview: 'form',
    previewLabel: 'Caixa de e-mail simulada',
    fields: [
      { key: 'caixa', label: 'Caixa monitorada', placeholder: 'atendimento@empresa.com.br' },
      { key: 'assinatura', label: 'Assinatura', placeholder: 'Equipe de atendimento' },
    ],
  },
  teams: {
    label: 'Teams e Slack',
    icon: MessagesSquare,
    description: 'Bot interno para colaboradores.',
    preview: 'form',
    previewLabel: 'Conversa simulada',
    fields: [
      { key: 'plataforma', label: 'Plataforma', placeholder: 'Microsoft Teams' },
      { key: 'bot', label: 'Nome do bot', placeholder: 'Assistente interno' },
      { key: 'equipes', label: 'Equipes com acesso', placeholder: 'Atendimento, Financeiro' },
    ],
  },
  agentes: {
    label: 'Agentes autônomos',
    icon: Bot,
    description: 'Exposição da jornada para outros agentes.',
    preview: 'form',
    previewLabel: 'Troca de mensagens entre agentes',
    fields: [
      { key: 'protocolo', label: 'Protocolo', placeholder: 'MCP (ferramenta) ou A2A' },
      { key: 'descricao', label: 'Descrição para outros agentes', placeholder: 'Resolve pedidos de segunda via e contestação' },
      { key: 'escopo', label: 'Escopo', placeholder: 'somente leitura + abertura de protocolo' },
    ],
  },
};

export const PREFIX: Record<IndustryId, string> = { saude: 'sau', varejo: 'var', financeiro: 'fin', telecom: 'tel' };

/** Perfis que configuram canais e vínculos no protótipo. */
export const CHANNEL_EDITORS: ProfileId[] = ['champion', 'engenheiro_ai', 'engenheiro_dados'];

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
