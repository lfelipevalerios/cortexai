import type { ModuleId } from '@cortex/schemas';
import {
  LayoutDashboard, Lightbulb, Brain, Boxes, Workflow, Layers, Plug, Database,
  BookOpen, MessagesSquare, Code2, ShieldCheck, Activity, type LucideIcon,
} from 'lucide-react';

export interface ModuleDef {
  id: ModuleId;
  label: string;
  href: string;
  icon: LucideIcon;
  group: 'Visão' | 'Cérebro' | 'Construir' | 'Conectar' | 'Governar';
  help: string;
}

export const MODULES: ModuleDef[] = [
  { id: 'cockpit', label: 'Cockpit', href: '/cockpit', icon: LayoutDashboard, group: 'Visão', help: 'Valor, adoção e risco em uma vista, com o mapa do ecossistema.' },
  { id: 'iniciativas', label: 'Iniciativas', href: '/iniciativas', icon: Lightbulb, group: 'Visão', help: 'Ideias percorrem Ideia, Validação, Protótipo, Construção e Operação; o super harness valida e gera em cada estágio.' },
  { id: 'cerebro', label: 'Cérebro', href: '/cerebro', icon: Brain, group: 'Cérebro', help: 'O que a empresa sabe: visão de negócio, regras em tabela de decisão e padrões técnicos.' },
  { id: 'catalogo', label: 'Catálogo', href: '/catalogo', icon: Boxes, group: 'Cérebro', help: 'Componentes agênticos versionados (skill, agent, rule, MCP, hook, documento, pacote) e seu ciclo de homologação.' },
  { id: 'jornadas', label: 'Jornadas', href: '/jornadas', icon: Workflow, group: 'Construir', help: 'O Studio transforma iniciativas em fluxos de caixinhas, testáveis passo a passo.' },
  { id: 'ambientes', label: 'Ambientes & releases', href: '/ambientes', icon: Layers, group: 'Construir', help: 'Versões por ambiente e promoção Dev → Hml → Prd com gates e aprovação humana.' },
  { id: 'conectores', label: 'Conectores', href: '/conectores', icon: Plug, group: 'Conectar', help: 'Ligam o cérebro ao ecossistema. Todo conector nasce exposto como tool para agentes, com política.' },
  { id: 'dados', label: 'Dados', href: '/dados', icon: Database, group: 'Conectar', help: 'Domínios, contratos de dados visuais, lakehouse em camadas e linhagem.' },
  { id: 'conhecimento', label: 'Conhecimento', href: '/conhecimento', icon: BookOpen, group: 'Conectar', help: 'Base de conhecimento agêntica: coleções, ingestão, teste de recuperação e grafo.' },
  { id: 'canais', label: 'Canais', href: '/canais', icon: MessagesSquare, group: 'Conectar', help: 'Levam as jornadas até o cliente: WhatsApp, web, app, voz, backoffice e mais.' },
  { id: 'ides', label: 'IDEs & MCP', href: '/ides', icon: Code2, group: 'Conectar', help: 'O servidor MCP do Córtex leva o cérebro até o desenvolvedor na IDE.' },
  { id: 'governanca', label: 'Governança', href: '/governanca', icon: ShieldCheck, group: 'Governar', help: 'Políticas aplicadas no desenho, na promoção, na construção e na execução; aprovações e auditoria.' },
  { id: 'telemetria', label: 'Telemetria', href: '/telemetria', icon: Activity, group: 'Governar', help: 'Do esforço ao valor: operação, agêntica, engenharia, negócio e dados, com traces e sugestões.' },
];

export const GROUPS = ['Visão', 'Cérebro', 'Construir', 'Conectar', 'Governar'] as const;

export function moduleForPath(path: string): ModuleDef | undefined {
  return MODULES.find((m) => path === m.href || path.startsWith(m.href + '/'));
}
