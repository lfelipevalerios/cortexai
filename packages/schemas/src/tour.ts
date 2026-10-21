// Tipos da jornada guiada (seção 13). Os passos ficam em configuração
// (packages/tour), não no código das telas.

export interface TourChapter {
  id: number;
  title: string;
  screen: string;
  happens: string;
  impact: string;
}

export interface TourStep {
  id: string;
  chapter: number;
  /** Rota da aplicação, ex.: "/conectores". */
  route: string;
  /** Seletor do elemento-alvo: valor do atributo data-tour. */
  target?: string;
  title: string;
  narration: string;
  /** Fala sugerida ao apresentador. */
  speech: string;
  /** Id da ação automática do piloto (registrada pela tela). */
  autoAction?: string;
  /** "next" ou "action:<id>" — avança quando a tela emite a ação. */
  advanceOn: string;
  /** Id do ponto de restauração aplicado ao entrar no passo. */
  restoreState?: string;
  planB: string;
}

export interface TourScript {
  id: 'completo' | 'executivo' | 'tecnico';
  name: string;
  chapters: number[];
  audience: string;
}
