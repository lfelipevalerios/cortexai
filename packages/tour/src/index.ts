// Jornada guiada (seção 13) como configuração.
// As telas não conhecem o roteiro: só expõem os alvos (atributo data-tour)
// e registram as ações automáticas listadas em TOUR_TARGETS.
// Ajustar o roteiro para um cliente = editar este arquivo, sem mexer nas telas.

import type { TourChapter, TourScript, TourStep } from '@cortex/schemas';

// ---------------------------------------------------------------------------
// Capítulos — tabela "Roteiro completo"
// ---------------------------------------------------------------------------

export const TOUR_CHAPTERS: TourChapter[] = [
  {
    id: 0,
    title: 'Abertura',
    screen: 'Seleção de workspace',
    happens: 'Quatro cartões de indústria; o apresentador escolhe a do público',
    impact: 'A demo fala a língua do setor desde o início',
  },
  {
    id: 1,
    title: 'As ilhas',
    screen: 'Mapa do ecossistema',
    happens: 'Sistemas da empresa aparecem isolados, sem ligações',
    impact: 'O problema do slide 3 em tela',
  },
  {
    id: 2,
    title: 'Conectar',
    screen: 'Conectores',
    happens: 'Wizard cadastra o CRM, testa, descobre objetos; OpenAPI vira conector',
    impact: 'Conexão real acontecendo em segundos',
  },
  {
    id: 3,
    title: 'Organizar',
    screen: 'Dados e Conhecimento',
    happens: 'Domínio, contrato visual, bloqueio de mudança que quebra; pergunta à base',
    impact: 'O dado ganha significado de negócio',
  },
  {
    id: 4,
    title: 'O cérebro',
    screen: 'Mapa do cérebro e Catálogo',
    happens: 'O mapa acende; uma regra é testada e publicada como componente',
    impact: 'O conhecimento da empresa vira ativo governado',
  },
  {
    id: 5,
    title: 'Criar',
    screen: 'Iniciativas e Studio',
    happens: 'Ideia validada nas 8 checagens; jornada gerada, testada e corrigida por guardrail',
    impact: 'Da ideia ao fluxo funcionando',
  },
  {
    id: 6,
    title: 'Entregar',
    screen: 'Canais, Ambientes e IDEs & MCP',
    happens:
      'WhatsApp plugado; conversa no simulador; a jornada é construída, executado no Claude Code, e o Studio acende nó a nó',
    impact: 'Negócio e engenharia no mesmo cérebro',
  },
  {
    id: 7,
    title: 'Governar e medir',
    screen: 'Governança, Telemetria e Cockpit',
    happens: 'Gate bloqueia Prd; "Ver como" aprova; trace; sugestão vira skill; antes e depois',
    impact: 'Controle e valor na mesma vista',
  },
  {
    id: 8,
    title: 'Como começamos',
    screen: 'Encerramento',
    happens:
      'Semear, Provar, Escalar sobre o workspace da demo; próximo passo em aberto para o cliente decidir',
    impact: 'Convite, não imposição',
  },
];

// ---------------------------------------------------------------------------
// Roteiros prontos
// ---------------------------------------------------------------------------

export const TOUR_SCRIPTS: TourScript[] = [
  {
    id: 'completo',
    name: 'Completo',
    chapters: [0, 1, 2, 3, 4, 5, 6, 7, 8],
    audience: 'Diretoria e primeira apresentação a clientes',
  },
  {
    id: 'executivo',
    name: 'Executivo',
    chapters: [0, 1, 4, 5, 7, 8],
    audience: 'C-level com pouco tempo',
  },
  {
    id: 'tecnico',
    name: 'Técnico',
    chapters: [0, 2, 3, 5, 6, 7],
    audience:
      'CTO, arquitetura e engenharia, com aprofundamento em contratos, Studio e MCP',
  },
];

// ---------------------------------------------------------------------------
// Contrato com as telas: alvos (data-tour) e ações automáticas por rota.
// Rota "*" = elementos do shell (cabeçalho/menu), presentes em qualquer tela.
// Toda ação deve: (1) ser executável pelo piloto automático e (2) ser emitida
// pela tela também quando o usuário faz o mesmo clique manualmente.
// ---------------------------------------------------------------------------

export interface TourRouteContract {
  targets: Record<string, string>;
  actions: Record<string, string>;
}

export const TOUR_TARGETS = {
  '*': {
    targets: {
      'ver-como':
        'Seletor "Ver como" no cabeçalho, para entrar com o perfil de outra pessoa (ex.: dono de negócio)',
    },
    actions: {
      'vercomo.dono-negocio':
        'Troca o perfil ativo para o dono de negócio da jornada anchor do workspace',
    },
  },
  '/': {
    targets: {
      'ws-cards': 'Grade com os 4 cartões de indústria (workspaces)',
    },
    actions: {
      'ws.escolher-anchor':
        'Seleciona o workspace da indústria do público (o anchor da sessão) e navega para /cockpit',
    },
  },
  '/cockpit': {
    targets: {
      'cockpit-ecossistema':
        'Seção "Mapa do ecossistema": sistemas da empresa; no modo "antes" aparecem como ilhas sem ligações',
      'cockpit-antes-depois': 'Botão de alternância "antes do Córtex / com o Córtex"',
      'cockpit-kpis': 'Faixa de KPIs do Cockpit (dados de demonstração)',
    },
    actions: {
      'cockpit.alternar':
        'Alterna o Cockpit entre "antes do Córtex" e "com o Córtex" (mapa, KPIs e linha de base)',
    },
  },
  '/conectores': {
    targets: {
      'conectores-galeria': 'Galeria de conectores disponíveis e cadastrados',
      'conector-card-crm': 'Cartão do CRM do workspace na galeria',
      'wizard-passo-config': 'Passo de configuração do wizard (endpoint, autenticação, ambiente)',
      'wizard-passo-teste':
        'Passo "Testar conexão" com as 4 checagens (rede, autenticação, permissão, latência)',
      'wizard-descoberta': 'Lista de objetos descobertos, com PII mascarada',
      'wizard-concluir': 'Botão "Concluir" do wizard',
      'openapi-importar':
        'Área "Importar OpenAPI" e, após importar, a lista de tools geradas',
    },
    actions: {
      'wizard.abrir-crm': 'Abre o wizard de cadastro do CRM, pré-preenchido',
      'wizard.preencher': 'Preenche os campos de configuração com os valores do workspace',
      'wizard.testar': 'Roda as 4 checagens em sequência, cada uma com ícone e tempo',
      'wizard.descobrir': 'Executa a descoberta e mostra os objetos com PII mascarada',
      'wizard.concluir': 'Conclui o cadastro; o conector aparece como Conectado em Dev',
      'openapi.importar-exemplo':
        'Importa a especificação OpenAPI de exemplo e mostra as tools geradas',
    },
  },
  '/dados': {
    targets: {
      'dados-dominio-cliente': 'Domínio Cliente na lista de domínios (camadas, dono, qualidade)',
      'contrato-visual': 'Contrato do domínio Cliente na visão visual',
      'contrato-campo-usado': 'Campo do contrato usado por uma jornada em Prd',
      'contrato-publicar':
        'Botão "Publicar" do contrato e, após a tentativa, o painel de bloqueio com o impacto',
    },
    actions: {
      'dados.abrir-contrato': 'Abre o contrato do domínio Cliente na visão visual',
      'contrato.remover-campo-usado': 'Remove do rascunho o campo usado por jornada em Prd',
      'contrato.tentar-publicar':
        'Tenta publicar; a publicação é bloqueada e o impacto (jornadas, canais) aparece',
    },
  },
  '/conhecimento': {
    targets: {
      'conhecimento-pergunta':
        'Campo de pergunta à base e, após responder, o trecho recuperado com a fonte',
    },
    actions: {
      'conhecimento.perguntar':
        'Faz a pergunta de exemplo do workspace e mostra o trecho da política com a fonte',
    },
  },
  '/cerebro': {
    targets: {
      'cerebro-mapa': 'Mapa do cérebro (áreas, regras, conhecimento e componentes)',
      'regra-tabela': 'Tabela de decisão da regra do setor',
      'regra-testar': 'Painel "Testar caso" da regra',
      'regra-publicar': 'Botão "Publicar como componente" da regra',
    },
    actions: {
      'cerebro.acender': 'Acende o mapa área por área com o que foi conectado e organizado',
      'regra.abrir': 'Abre a tabela de decisão da regra do setor',
      'regra.testar-caso': 'Roda um caso de teste e destaca a linha da tabela que decidiu',
      'regra.publicar': 'Publica a regra como componente Rule no catálogo',
    },
  },
  '/catalogo': {
    targets: {
      'catalogo-componente':
        'Detalhe do componente Rule recém-publicado (versão, consumidores, aprovação do CoE AI)',
    },
    actions: {},
  },
  '/iniciativas': {
    targets: {
      'iniciativa-nova': 'Botão/formulário "Nova iniciativa"',
      'iniciativa-validar': 'Botão "Validar no cérebro"',
      'validacao-relatorio':
        'Relatório com as 8 checagens (verde/amarelo/vermelho), % de reuso e lacunas',
      'validacao-seguir': 'Botões "Seguir" e "Rever" do patrocinador; após Seguir, o protótipo de conversa',
      'gerar-jornada': 'Botão "Gerar jornada"',
    },
    actions: {
      'iniciativa.registrar-ideia': 'Registra a ideia de exemplo do setor',
      'iniciativa.validar': 'Roda as 8 checagens em sequência, com a fonte no cérebro',
      'iniciativa.seguir': 'Clica em "Seguir"; o protótipo de conversa aparece',
      'iniciativa.gerar-jornada': 'Gera a jornada e abre o rascunho em /jornadas/studio',
    },
  },
  '/jornadas/studio': {
    targets: {
      'studio-canvas': 'Canvas do fluxo (caixinhas ligadas)',
      'studio-testar': 'Botão "Testar com persona"',
      'studio-problemas': 'Painel de problemas da validação (ex.: PII indo ao canal sem filtro)',
      'studio-corrigir-pii': 'Ação "Inserir filtro de PII" no problema apontado',
      'studio-promover': 'Botão "Promover" (Dev → Hml)',
      'promocao-gates': 'Painel de gates da promoção, preenchendo-se um a um',
      'studio-construir': 'Botão "Enviar para construção"',
      'studio-progresso':
        'Indicador de progresso da construção (OC) sobre o canvas, nó a nó, com PR e evidências ao final',
      'promocao-prd': 'Ação "Promover para Prd" e o gate que a bloqueia, com o motivo',
    },
    actions: {
      'studio.testar': 'Roda o teste com a persona; a validação acusa PII sem filtro',
      'studio.corrigir-pii': 'Insere o nó de filtro de PII e reexecuta o teste (passa)',
      'studio.promover-hml': 'Promove de Dev para Hml, preenchendo os gates na tela',
      'studio.enviar-construcao':
        'Gera o pacote de construção (OC) para ser executado no Claude Code',
      'studio.simular-construcao':
        'Acende o canvas nó a nó como se a construção estivesse em andamento (plano B; usa OC já construída)',
      'promocao.tentar-prd':
        'Tenta promover para Prd sem aprovação do dono de negócio; o gate bloqueia',
    },
  },
  '/canais': {
    targets: {
      'canais-whatsapp': 'Cartão do canal WhatsApp e o vínculo com a jornada promovida',
      'canal-simulador': 'Simulador de conversa do canal',
    },
    actions: {
      'canal.plugar-whatsapp': 'Pluga o WhatsApp na jornada promovida (Hml)',
      'canal.enviar-mensagem':
        'Envia a mensagem de exemplo do cliente fictício e mostra a resposta da jornada',
    },
  },
  '/ambientes': {
    targets: {
      'ambientes-pipeline': 'Esteira Dev → Hml → Prd com a jornada e seus gates',
    },
    actions: {},
  },
  '/ides': {
    targets: {
      'ides-conexao': 'Cartão da IDE conectada ao MCP do Córtex (status, ferramentas, última chamada)',
    },
    actions: {},
  },
  '/governanca': {
    targets: {
      'governanca-aprovacoes': 'Fila de aprovações pendentes, com a promoção para Prd',
    },
    actions: {
      'governanca.aprovar': 'Aprova a promoção para Prd como dono de negócio',
    },
  },
  '/telemetria': {
    targets: {
      'telemetria-trace': 'Trace de uma execução com o guardrail acionado destacado',
      'sugestao-aceitar': 'Cartão de sugestão do cérebro com o botão "Aceitar"',
    },
    actions: {
      'telemetria.abrir-trace-guardrail': 'Abre o trace de uma execução em que o guardrail agiu',
      'sugestao.aceitar': 'Aceita a sugestão; o rascunho da skill é criado no Catálogo',
    },
  },
  '/encerramento': {
    targets: {
      'encerramento-semear': 'Coluna/etapa "Semear"',
      'encerramento-provar': 'Coluna/etapa "Provar"',
      'encerramento-escalar': 'Coluna/etapa "Escalar"',
      'encerramento-plano':
        'Próximo passo em aberto e a tabela "Do mock à versão inicial"',
    },
    actions: {},
  },
} satisfies Record<string, TourRouteContract>;

export type TourRoute = keyof typeof TOUR_TARGETS;

// ---------------------------------------------------------------------------
// Passos
// ---------------------------------------------------------------------------

export const TOUR_STEPS: TourStep[] = [
  // ── 0 Abertura ──────────────────────────────────────────────────────────
  {
    id: 'c0-boas-vindas',
    chapter: 0,
    route: '/',
    target: 'ws-cards',
    title: 'Um Córtex por indústria',
    narration:
      'Quatro empresas fictícias completas, uma por setor, para a conversa usar a língua do negócio de quem assiste.',
    speech:
      'Antes de tudo, escolhemos o setor de vocês: tudo o que vamos ver usa sistemas, dados e regras típicos dessa indústria.',
    advanceOn: 'next',
    restoreState: 'chapter-0',
    planB: 'Se a grade não carregar, use "Restaurar demo" e recarregue a página.',
  },
  {
    id: 'c0-escolher-workspace',
    chapter: 0,
    route: '/',
    target: 'ws-cards',
    title: 'Escolher o workspace',
    narration:
      'Ao escolher o setor, o Córtex carrega a empresa, seus sistemas e indicadores, prontos para a demonstração.',
    speech: 'Vamos entrar na empresa de exemplo do seu setor.',
    autoAction: 'ws.escolher-anchor',
    advanceOn: 'action:ws.escolher-anchor',
    planB: 'Clique manualmente no cartão da indústria do público.',
  },

  // ── 1 As ilhas ──────────────────────────────────────────────────────────
  {
    id: 'c1-ilhas',
    chapter: 1,
    route: '/cockpit',
    target: 'cockpit-ecossistema',
    title: 'As ilhas',
    narration:
      'Os sistemas da empresa aparecem isolados, sem ligações: cada iniciativa de IA recomeça do zero.',
    speech:
      'É assim que a maioria das empresas está hoje: CRM, faturamento, atendimento e dados, cada um na sua ilha.',
    advanceOn: 'next',
    restoreState: 'chapter-1',
    planB: 'Se o mapa aparecer ligado, clique no botão "antes do Córtex".',
  },
  {
    id: 'c1-custo-das-ilhas',
    chapter: 1,
    route: '/cockpit',
    target: 'cockpit-kpis',
    title: 'O custo das ilhas',
    narration:
      'Com tudo separado, os indicadores mostram retrabalho, prazos longos e pouco reuso entre projetos.',
    speech:
      'Esses números são a linha de base. No fim da demo voltamos aqui para ver o que muda com o cérebro.',
    advanceOn: 'next',
    planB: 'Fale sobre os indicadores sem apontar valores; são dados de demonstração.',
  },

  // ── 2 Conectar ──────────────────────────────────────────────────────────
  {
    id: 'c2-galeria',
    chapter: 2,
    route: '/conectores',
    target: 'conectores-galeria',
    title: 'Conectar sem projeto de integração',
    narration:
      'O primeiro passo é ligar as ilhas: conectores prontos, governados por ambiente, em vez de integrações sob medida.',
    speech: 'Vamos ligar o primeiro sistema agora, ao vivo.',
    advanceOn: 'next',
    restoreState: 'chapter-2',
    planB: 'Se a galeria estiver vazia, use "Restaurar demo" deste capítulo.',
  },
  {
    id: 'c2-wizard-abrir',
    chapter: 2,
    route: '/conectores',
    target: 'conector-card-crm',
    title: 'Cadastrar o CRM',
    narration: 'O wizard abre já pré-preenchido com o CRM da empresa.',
    speech: 'Começamos pelo CRM, onde está o cliente.',
    autoAction: 'wizard.abrir-crm',
    advanceOn: 'action:wizard.abrir-crm',
    planB: 'Clique no cartão do CRM manualmente.',
  },
  {
    id: 'c2-wizard-preencher',
    chapter: 2,
    route: '/conectores',
    target: 'wizard-passo-config',
    title: 'Configuração guiada',
    narration:
      'Endereço, autenticação e ambiente em um só passo; credenciais ficam no cofre, nunca na tela.',
    speech: 'Nada de código: o wizard pede só o essencial.',
    autoAction: 'wizard.preencher',
    advanceOn: 'action:wizard.preencher',
    planB: 'Os campos já vêm preenchidos; apenas avance.',
  },
  {
    id: 'c2-wizard-teste',
    chapter: 2,
    route: '/conectores',
    target: 'wizard-passo-teste',
    title: 'Testar a conexão',
    narration:
      'Quatro checagens em sequência (rede, autenticação, permissão e latência) dão confiança antes de usar o dado.',
    speech: 'Em segundos sabemos se a conexão está saudável e, se não estiver, por quê.',
    autoAction: 'wizard.testar',
    advanceOn: 'action:wizard.testar',
    planB: 'Se uma checagem falhar, mostre a causa e a correção sugerida: isso também é o produto.',
  },
  {
    id: 'c2-wizard-descoberta',
    chapter: 2,
    route: '/conectores',
    target: 'wizard-descoberta',
    title: 'Descobrir objetos',
    narration:
      'O Córtex descobre os objetos do sistema e já mascara os dados pessoais.',
    speech: 'Repare: CPF e telefone aparecem mascarados desde o primeiro contato.',
    autoAction: 'wizard.descobrir',
    advanceOn: 'action:wizard.descobrir',
    planB: 'Se a descoberta demorar, use o resultado salvo deste capítulo.',
  },
  {
    id: 'c2-wizard-concluir',
    chapter: 2,
    route: '/conectores',
    target: 'wizard-concluir',
    title: 'Conector pronto',
    narration: 'O CRM entra conectado em Dev; chegar a Prd só por promoção.',
    speech: 'Uma conexão que levaria semanas, pronta e governada.',
    autoAction: 'wizard.concluir',
    advanceOn: 'action:wizard.concluir',
    planB: 'Clique em "Concluir" manualmente.',
  },
  {
    id: 'c2-openapi',
    chapter: 2,
    route: '/conectores',
    target: 'openapi-importar',
    title: 'OpenAPI vira conector',
    narration:
      'Uma especificação OpenAPI importada vira conector com tools prontas para jornadas e agentes.',
    speech: 'E qualquer API documentada vira conector em segundos.',
    autoAction: 'openapi.importar-exemplo',
    advanceOn: 'action:openapi.importar-exemplo',
    planB: 'Se a importação falhar, mostre o conector OpenAPI já cadastrado na galeria.',
  },

  // ── 3 Organizar ─────────────────────────────────────────────────────────
  {
    id: 'c3-dominio',
    chapter: 3,
    route: '/dados',
    target: 'dados-dominio-cliente',
    title: 'O domínio Cliente',
    narration:
      'O dado conectado ganha dono, camadas e qualidade: vira um domínio de negócio, não uma tabela solta.',
    speech: 'Aqui o dado passa a significar algo para o negócio.',
    advanceOn: 'next',
    restoreState: 'chapter-3',
    planB: 'Se o domínio não aparecer, use "Restaurar demo" deste capítulo.',
  },
  {
    id: 'c3-contrato-visual',
    chapter: 3,
    route: '/dados',
    target: 'contrato-visual',
    title: 'Contrato visual',
    narration:
      'O contrato descreve campos, regras e privacidade de forma que negócio e engenharia leem igual.',
    speech: 'Esse contrato é o acordo entre quem produz e quem consome o dado.',
    autoAction: 'dados.abrir-contrato',
    advanceOn: 'action:dados.abrir-contrato',
    planB: 'Abra o contrato manualmente pelo domínio Cliente.',
  },
  {
    id: 'c3-remover-campo',
    chapter: 3,
    route: '/dados',
    target: 'contrato-campo-usado',
    title: 'Uma mudança que quebra',
    narration: 'Vamos remover um campo que uma jornada em produção usa.',
    speech: 'O que acontece se alguém apagar esse campo sem saber quem depende dele?',
    autoAction: 'contrato.remover-campo-usado',
    advanceOn: 'action:contrato.remover-campo-usado',
    planB: 'Remova o campo manualmente no editor visual.',
  },
  {
    id: 'c3-bloqueio',
    chapter: 3,
    route: '/dados',
    target: 'contrato-publicar',
    title: 'Bloqueio com impacto',
    narration:
      'A publicação é bloqueada e o impacto aparece: jornadas e canais que quebrariam em produção.',
    speech: 'O erro é evitado no desenho, não descoberto pelo cliente final.',
    autoAction: 'contrato.tentar-publicar',
    advanceOn: 'action:contrato.tentar-publicar',
    planB: 'Se o bloqueio não aparecer, descreva-o e siga para a base de conhecimento.',
  },
  {
    id: 'c3-pergunta',
    chapter: 3,
    route: '/conhecimento',
    target: 'conhecimento-pergunta',
    title: 'Perguntar à base',
    narration:
      'A base de conhecimento responde com o trecho da política e a fonte, pronta para jornadas usarem.',
    speech: 'Políticas e procedimentos viram conhecimento consultável, sempre com a fonte.',
    autoAction: 'conhecimento.perguntar',
    advanceOn: 'action:conhecimento.perguntar',
    planB: 'Mostre a resposta salva da pergunta de exemplo.',
  },

  // ── 4 O cérebro ─────────────────────────────────────────────────────────
  {
    id: 'c4-mapa',
    chapter: 4,
    route: '/cerebro',
    target: 'cerebro-mapa',
    title: 'O mapa acende',
    narration:
      'Tudo o que foi conectado e organizado acende no mapa: o conhecimento da empresa num só lugar.',
    speech: 'Este é o cérebro: dados, conhecimento e regras que todas as iniciativas reaproveitam.',
    autoAction: 'cerebro.acender',
    advanceOn: 'action:cerebro.acender',
    restoreState: 'chapter-4',
    planB: 'Se a animação travar, use "Restaurar demo" deste capítulo; o mapa abre aceso.',
  },
  {
    id: 'c4-regra',
    chapter: 4,
    route: '/cerebro',
    target: 'regra-tabela',
    title: 'Uma regra do setor',
    narration:
      'Uma regra que vivia em planilhas e na cabeça das pessoas vira tabela de decisão legível.',
    speech: 'Quem conhece o negócio lê e ajusta essa regra sem depender de código.',
    autoAction: 'regra.abrir',
    advanceOn: 'action:regra.abrir',
    planB: 'Abra a regra manualmente pelo mapa.',
  },
  {
    id: 'c4-testar',
    chapter: 4,
    route: '/cerebro',
    target: 'regra-testar',
    title: 'Testar um caso',
    narration: 'Um caso real é testado e a linha que decidiu fica destacada.',
    speech: 'Antes de publicar, provamos que a regra decide como o negócio espera.',
    autoAction: 'regra.testar-caso',
    advanceOn: 'action:regra.testar-caso',
    planB: 'Explique o resultado esperado apontando a linha da tabela.',
  },
  {
    id: 'c4-publicar',
    chapter: 4,
    route: '/cerebro',
    target: 'regra-publicar',
    title: 'Publicar como componente',
    narration: 'A regra é publicada como componente, pronta para qualquer jornada reaproveitar.',
    speech: 'A partir de agora, essa regra é um ativo da empresa, não de um projeto.',
    autoAction: 'regra.publicar',
    advanceOn: 'action:regra.publicar',
    planB: 'Siga para o Catálogo; o componente já está publicado no estado salvo.',
  },
  {
    id: 'c4-catalogo',
    chapter: 4,
    route: '/catalogo',
    target: 'catalogo-componente',
    title: 'Ativo governado',
    narration:
      'No catálogo, o componente aparece com versão, consumidores e aprovação do CoE AI.',
    speech: 'Reuso com governança: sabemos quem usa, qual versão e quem aprovou.',
    advanceOn: 'next',
    planB: 'Busque o componente pelo nome da regra no catálogo.',
  },

  // ── 5 Criar ─────────────────────────────────────────────────────────────
  {
    id: 'c5-nova-ideia',
    chapter: 5,
    route: '/iniciativas',
    target: 'iniciativa-nova',
    title: 'Uma ideia do negócio',
    narration: 'O negócio registra uma ideia do setor em linguagem natural.',
    speech: 'Tudo começa com uma ideia de quem conhece o cliente.',
    autoAction: 'iniciativa.registrar-ideia',
    advanceOn: 'action:iniciativa.registrar-ideia',
    restoreState: 'chapter-5',
    planB: 'Se o formulário falhar, abra a iniciativa de exemplo já registrada.',
  },
  {
    id: 'c5-validar',
    chapter: 5,
    route: '/iniciativas',
    target: 'iniciativa-validar',
    title: 'Validar no cérebro',
    narration:
      'Oito checagens consultam o cérebro, executado no Claude Code, para medir viabilidade antes de investir.',
    speech: 'Em vez de semanas de levantamento, o cérebro valida a ideia em instantes.',
    autoAction: 'iniciativa.validar',
    advanceOn: 'action:iniciativa.validar',
    planB: 'Use o relatório de validação salvo deste capítulo.',
  },
  {
    id: 'c5-relatorio',
    chapter: 5,
    route: '/iniciativas',
    target: 'validacao-relatorio',
    title: 'O cérebro indica',
    narration:
      'O relatório mostra o reuso de componentes e uma lacuna de dado; a recomendação é consultiva.',
    speech: 'O cérebro indica o caminho e os pontos de atenção; a decisão continua sendo nossa.',
    advanceOn: 'next',
    planB: 'Destaque o percentual de reuso e a lacuna, mesmo sem a animação.',
  },
  {
    id: 'c5-seguir',
    chapter: 5,
    route: '/iniciativas',
    target: 'validacao-seguir',
    title: 'Seguir e prototipar',
    narration: 'Com "Seguir", o protótipo de conversa aparece para o patrocinador experimentar.',
    speech: 'O patrocinador decide seguir e já vê como a conversa vai ser.',
    autoAction: 'iniciativa.seguir',
    advanceOn: 'action:iniciativa.seguir',
    planB: 'Clique em "Seguir" manualmente.',
  },
  {
    id: 'c5-gerar-jornada',
    chapter: 5,
    route: '/iniciativas',
    target: 'gerar-jornada',
    title: 'Gerar a jornada',
    narration: 'Um clique transforma a iniciativa validada em rascunho de jornada no Studio.',
    speech: 'Da ideia ao fluxo, sem começar do zero.',
    autoAction: 'iniciativa.gerar-jornada',
    advanceOn: 'action:iniciativa.gerar-jornada',
    planB: 'Abra o Studio pelo menu; a jornada anchor do workspace abre por padrão.',
  },
  {
    id: 'c5-studio',
    chapter: 5,
    route: '/jornadas/studio',
    target: 'studio-canvas',
    title: 'A jornada no Studio',
    narration:
      'Cada caixinha é uma etapa que consome dados, conhecimento e componentes do cérebro.',
    speech: 'Repare que a regra que publicamos há pouco já está aqui, reaproveitada.',
    advanceOn: 'next',
    planB: 'Se o canvas não abrir, recarregue /jornadas/studio.',
  },
  {
    id: 'c5-testar',
    chapter: 5,
    route: '/jornadas/studio',
    target: 'studio-testar',
    title: 'Testar com uma persona',
    narration:
      'O teste com uma persona acusa dado pessoal indo para o WhatsApp sem filtro.',
    speech: 'O guardrail pegou um risco que, em produção, viraria incidente.',
    autoAction: 'studio.testar',
    advanceOn: 'action:studio.testar',
    planB: 'Abra o painel de problemas; o apontamento de PII está no estado salvo.',
  },
  {
    id: 'c5-corrigir-pii',
    chapter: 5,
    route: '/jornadas/studio',
    target: 'studio-corrigir-pii',
    title: 'Corrigir com um clique',
    narration: 'Um clique insere o filtro de PII e o teste passa.',
    speech: 'A correção vem do próprio padrão da empresa, não de improviso.',
    autoAction: 'studio.corrigir-pii',
    advanceOn: 'action:studio.corrigir-pii',
    planB: 'Arraste o nó de filtro de PII antes do envio ao canal.',
  },
  {
    id: 'c5-promover-hml',
    chapter: 5,
    route: '/jornadas/studio',
    target: 'promocao-gates',
    title: 'Promover para Hml',
    narration:
      'A jornada sai de Dev para Hml e os gates se preenchem na tela, um a um.',
    speech: 'Cada ambiente tem suas regras, e elas são verificadas automaticamente.',
    autoAction: 'studio.promover-hml',
    advanceOn: 'action:studio.promover-hml',
    planB: 'Mostre a jornada já em Hml em /ambientes.',
  },

  // ── 6 Entregar ──────────────────────────────────────────────────────────
  {
    id: 'c6-plugar-whatsapp',
    chapter: 6,
    route: '/canais',
    target: 'canais-whatsapp',
    title: 'Plugar o WhatsApp',
    narration: 'A jornada promovida é plugada no WhatsApp sem nova integração.',
    speech: 'O mesmo fluxo pode atender em qualquer canal; hoje, o WhatsApp.',
    autoAction: 'canal.plugar-whatsapp',
    advanceOn: 'action:canal.plugar-whatsapp',
    restoreState: 'chapter-6',
    planB: 'Use "Restaurar demo" deste capítulo; o canal já vem plugado.',
  },
  {
    id: 'c6-simulador',
    chapter: 6,
    route: '/canais',
    target: 'canal-simulador',
    title: 'Conversar com a jornada',
    narration:
      'No simulador, o cliente fictício conversa e a jornada responde com dados reais do workspace.',
    speech: 'Esse cliente existe no CRM, tem fatura no domínio e vai aparecer no trace.',
    autoAction: 'canal.enviar-mensagem',
    advanceOn: 'action:canal.enviar-mensagem',
    planB: 'Mostre a conversa salva no histórico do simulador.',
  },
  {
    id: 'c6-ambientes',
    chapter: 6,
    route: '/ambientes',
    target: 'ambientes-pipeline',
    title: 'Dev, Hml e Prd',
    narration: 'A esteira mostra a jornada em Hml e o que falta para chegar a produção.',
    speech: 'Negócio vê onde cada jornada está, sem perguntar para a TI.',
    advanceOn: 'next',
    planB: 'Pule este passo se o tempo estiver curto.',
  },
  {
    id: 'c6-ides',
    chapter: 6,
    route: '/ides',
    target: 'ides-conexao',
    title: 'A engenharia no mesmo cérebro',
    narration:
      'A IDE já está conectada ao Córtex por MCP: o desenvolvedor usa o mesmo catálogo e os mesmos guardrails.',
    speech: 'Negócio desenha aqui, engenharia constrói na IDE, e os dois falam com o mesmo cérebro.',
    advanceOn: 'next',
    planB: 'Mostre o comando de conexão e o status salvo da última chamada.',
  },
  {
    id: 'c6-enviar-construcao',
    chapter: 6,
    route: '/jornadas/studio',
    target: 'studio-construir',
    title: 'Enviar para construção',
    narration:
      'A jornada vira um pacote de construção, executado no Claude Code seguindo o catálogo homologado.',
    speech: 'O Córtex desenha e governa; a construção segue exatamente esse desenho.',
    autoAction: 'studio.enviar-construcao',
    advanceOn: 'action:studio.enviar-construcao',
    planB: 'Se a IDE não estiver disponível, siga para o próximo passo com a OC já construída.',
  },
  {
    id: 'c6-studio-acende',
    chapter: 6,
    route: '/jornadas/studio',
    target: 'studio-progresso',
    title: 'O Studio acende nó a nó',
    narration:
      'Enquanto o código é escrito, cada caixinha acende; ao final, PR e evidências ficam ligados à jornada.',
    speech: 'O que a diretoria desenhou agora há pouco está virando código de verdade.',
    autoAction: 'studio.simular-construcao',
    advanceOn: 'action:studio.simular-construcao',
    planB:
      'Sem rede ou com limite de uso, o piloto usa a OC já construída e acende o Studio nó a nó.',
  },

  // ── 7 Governar e medir ──────────────────────────────────────────────────
  {
    id: 'c7-tentar-prd',
    chapter: 7,
    route: '/jornadas/studio',
    target: 'promocao-prd',
    title: 'Gate bloqueia Prd',
    narration:
      'Sem a aprovação do dono de negócio, o gate bloqueia a promoção e explica o motivo.',
    speech: 'Nada chega à produção sem quem responde pelo negócio dizer sim.',
    autoAction: 'promocao.tentar-prd',
    advanceOn: 'action:promocao.tentar-prd',
    restoreState: 'chapter-7',
    planB: 'Se o gate não aparecer, use "Restaurar demo" deste capítulo.',
  },
  {
    id: 'c7-ver-como',
    chapter: 7,
    route: '/governanca',
    target: 'ver-como',
    title: 'Ver como dono de negócio',
    narration: '"Ver como" mostra a tela com o perfil e as permissões do dono de negócio.',
    speech: 'Cada perfil vê e aprova só o que lhe cabe.',
    autoAction: 'vercomo.dono-negocio',
    advanceOn: 'action:vercomo.dono-negocio',
    planB: 'Troque o perfil pelo seletor no cabeçalho.',
  },
  {
    id: 'c7-aprovar',
    chapter: 7,
    route: '/governanca',
    target: 'governanca-aprovacoes',
    title: 'Aprovar a promoção',
    narration: 'O dono de negócio aprova e a promoção para Prd fica liberada, com registro na auditoria.',
    speech: 'Controle que não trava: aprovação no ponto certo, com rastro.',
    autoAction: 'governanca.aprovar',
    advanceOn: 'action:governanca.aprovar',
    planB: 'Mostre a aprovação já registrada na auditoria.',
  },
  {
    id: 'c7-trace',
    chapter: 7,
    route: '/telemetria',
    target: 'telemetria-trace',
    title: 'Trace com guardrail',
    narration:
      'Um trace mostra passo a passo uma execução em que o guardrail agiu para proteger o cliente.',
    speech: 'Sabemos o que cada jornada fez, quando e por quê.',
    autoAction: 'telemetria.abrir-trace-guardrail',
    advanceOn: 'action:telemetria.abrir-trace-guardrail',
    planB: 'Filtre a lista de traces por "guardrail acionado".',
  },
  {
    id: 'c7-sugestao',
    chapter: 7,
    route: '/telemetria',
    target: 'sugestao-aceitar',
    title: 'O cérebro aprende',
    narration:
      'A telemetria vira sugestão do cérebro; aceitar cria o rascunho de uma nova skill no Catálogo.',
    speech: 'O uso realimenta o cérebro: cada jornada deixa a próxima melhor.',
    autoAction: 'sugestao.aceitar',
    advanceOn: 'action:sugestao.aceitar',
    planB: 'Mostre o rascunho da skill já criado no Catálogo.',
  },
  {
    id: 'c7-antes-depois',
    chapter: 7,
    route: '/cockpit',
    target: 'cockpit-antes-depois',
    title: 'Antes e depois',
    narration:
      'No Cockpit, alternar antes e depois mostra as ilhas ligadas e os indicadores sobre a linha de base.',
    speech: 'Esta é a mesma tela do começo: agora com o cérebro no centro.',
    autoAction: 'cockpit.alternar',
    advanceOn: 'action:cockpit.alternar',
    planB: 'Clique no botão "com o Córtex" manualmente; números são de demonstração.',
  },

  // ── 8 Como começamos ────────────────────────────────────────────────────
  {
    id: 'c8-semear',
    chapter: 8,
    route: '/encerramento',
    target: 'encerramento-semear',
    title: 'Semear',
    narration: 'Começar pequeno: conectar os primeiros sistemas e montar o cérebro inicial.',
    speech: 'O primeiro passo é semear o cérebro com o que vocês já têm.',
    advanceOn: 'next',
    restoreState: 'chapter-8',
    planB: 'Se a tela não carregar, conduza o encerramento de forma verbal.',
  },
  {
    id: 'c8-provar',
    chapter: 8,
    route: '/encerramento',
    target: 'encerramento-provar',
    title: 'Provar',
    narration: 'Uma jornada de valor em produção, medida contra a linha de base.',
    speech: 'Depois, provamos valor com uma jornada que importa para o negócio.',
    advanceOn: 'next',
    planB: 'Volte ao Cockpit para reforçar a comparação antes e depois.',
  },
  {
    id: 'c8-escalar',
    chapter: 8,
    route: '/encerramento',
    target: 'encerramento-escalar',
    title: 'Escalar',
    narration: 'Com o cérebro formado, novas iniciativas reaproveitam o que já existe.',
    speech: 'E então escalamos: cada nova iniciativa custa menos que a anterior.',
    advanceOn: 'next',
    planB: 'Retome o percentual de reuso visto na validação da iniciativa.',
  },
  {
    id: 'c8-proximo-passo',
    chapter: 8,
    route: '/encerramento',
    target: 'encerramento-plano',
    title: 'O próximo passo é de vocês',
    narration:
      'O plano fica em aberto para o cliente decidir por onde começar, com o caminho do mock à versão inicial.',
    speech: 'Recomendamos avaliar juntos por onde faz mais sentido começar. Qual seria a primeira jornada de vocês?',
    advanceOn: 'next',
    planB: 'Encerre com a pergunta, sem depender da tela.',
  },
];

// ---------------------------------------------------------------------------
// Utilitários
// ---------------------------------------------------------------------------

/** Passos do roteiro, na ordem, filtrados pelos capítulos do script. */
export function stepsForScript(
  scriptId: TourScript['id'],
  steps: TourStep[] = TOUR_STEPS,
): TourStep[] {
  const script = TOUR_SCRIPTS.find((s) => s.id === scriptId);
  if (!script) return [];
  const chapters = new Set(script.chapters);
  return steps.filter((s) => chapters.has(s.chapter));
}

/** Índice do primeiro passo do capítulo na lista dada, ou -1. */
export function chapterStartIndex(steps: TourStep[], chapter: number): number {
  return steps.findIndex((s) => s.chapter === chapter);
}

/** Id da ação esperada por um passo (advanceOn "action:<id>"), ou undefined. */
export function advanceActionId(step: TourStep): string | undefined {
  return step.advanceOn.startsWith('action:') ? step.advanceOn.slice('action:'.length) : undefined;
}

/**
 * Confere a configuração contra o contrato de alvos/ações.
 * Retorna a lista de problemas (vazia quando está tudo certo).
 */
export function validateTour(steps: TourStep[] = TOUR_STEPS): string[] {
  const errors: string[] = [];
  const contracts = TOUR_TARGETS as Record<string, TourRouteContract>;
  const shell = contracts['*'];
  const ids = new Set<string>();
  let lastChapter = -1;
  const seenChapters = new Set<number>();

  for (const step of steps) {
    if (ids.has(step.id)) errors.push(`${step.id}: id duplicado`);
    ids.add(step.id);

    if (step.chapter < lastChapter) errors.push(`${step.id}: fora de ordem`);
    lastChapter = step.chapter;

    const first = !seenChapters.has(step.chapter);
    seenChapters.add(step.chapter);
    if (first && step.restoreState !== `chapter-${step.chapter}`)
      errors.push(`${step.id}: primeiro passo do capítulo sem restoreState`);

    const route = contracts[step.route];
    if (!route) {
      errors.push(`${step.id}: rota ${step.route} sem contrato`);
      continue;
    }
    if (step.target && !(step.target in route.targets) && !(step.target in shell.targets))
      errors.push(`${step.id}: alvo ${step.target} não declarado em ${step.route}`);

    const known = (a: string) => a in route.actions || a in shell.actions;
    if (step.autoAction && !known(step.autoAction))
      errors.push(`${step.id}: ação ${step.autoAction} não declarada em ${step.route}`);
    const adv = advanceActionId(step);
    if (adv && !known(adv)) errors.push(`${step.id}: advanceOn ${adv} não declarada`);
    if (step.advanceOn !== 'next' && !adv)
      errors.push(`${step.id}: advanceOn inválido (${step.advanceOn})`);
  }

  for (const ch of TOUR_CHAPTERS)
    if (!seenChapters.has(ch.id)) errors.push(`capítulo ${ch.id} sem passos`);

  return errors;
}
