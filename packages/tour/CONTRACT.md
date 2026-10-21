# Contrato da jornada guiada (`@cortex/tour`)

As telas não conhecem o roteiro. Cada tela só precisa:

1. Marcar os elementos-alvo com `data-tour="<alvo>"` (nomes abaixo, únicos na aplicação).
2. Registrar as ações automáticas (`autoAction`) que o piloto automático pode disparar.
3. Emitir a mesma ação quando o usuário faz o clique manualmente — passos com `advanceOn: "action:<id>"` avançam quando a ação é emitida, venha ela do usuário ou do piloto.
4. Respeitar os pontos de restauração `chapter-0` … `chapter-8` (aplicados no primeiro passo de cada capítulo).

Rota `*` = elementos do shell (cabeçalho/menu), presentes em qualquer tela. `/jornadas/studio` sem `?id=` abre a jornada anchor do workspace.

Fonte da verdade: `TOUR_TARGETS` em `src/index.ts`; `validateTour()` confere os passos contra este contrato.

## `*`

| Tipo | Id | O que é / o que faz | Passos |
|---|---|---|---|
| alvo | `ver-como` | Seletor "Ver como" no cabeçalho, para entrar com o perfil de outra pessoa (ex.: dono de negócio) | c7-ver-como |
| ação | `vercomo.dono-negocio` | Troca o perfil ativo para o dono de negócio da jornada anchor do workspace | c7-ver-como |

## `/`

| Tipo | Id | O que é / o que faz | Passos |
|---|---|---|---|
| alvo | `ws-cards` | Grade com os 4 cartões de indústria (workspaces) | c0-boas-vindas, c0-escolher-workspace |
| ação | `ws.escolher-anchor` | Seleciona o workspace da indústria do público (o anchor da sessão) e navega para /cockpit | c0-escolher-workspace |

## `/cockpit`

| Tipo | Id | O que é / o que faz | Passos |
|---|---|---|---|
| alvo | `cockpit-ecossistema` | Seção "Mapa do ecossistema": sistemas da empresa; no modo "antes" aparecem como ilhas sem ligações | c1-ilhas |
| alvo | `cockpit-antes-depois` | Botão de alternância "antes do Córtex / com o Córtex" | c7-antes-depois |
| alvo | `cockpit-kpis` | Faixa de KPIs do Cockpit (dados de demonstração) | c1-custo-das-ilhas |
| ação | `cockpit.alternar` | Alterna o Cockpit entre "antes do Córtex" e "com o Córtex" (mapa, KPIs e linha de base) | c7-antes-depois |

## `/conectores`

| Tipo | Id | O que é / o que faz | Passos |
|---|---|---|---|
| alvo | `conectores-galeria` | Galeria de conectores disponíveis e cadastrados | c2-galeria |
| alvo | `conector-card-crm` | Cartão do CRM do workspace na galeria | c2-wizard-abrir |
| alvo | `wizard-passo-config` | Passo de configuração do wizard (endpoint, autenticação, ambiente) | c2-wizard-preencher |
| alvo | `wizard-passo-teste` | Passo "Testar conexão" com as 4 checagens (rede, autenticação, permissão, latência) | c2-wizard-teste |
| alvo | `wizard-descoberta` | Lista de objetos descobertos, com PII mascarada | c2-wizard-descoberta |
| alvo | `wizard-concluir` | Botão "Concluir" do wizard | c2-wizard-concluir |
| alvo | `openapi-importar` | Área "Importar OpenAPI" e, após importar, a lista de tools geradas | c2-openapi |
| ação | `wizard.abrir-crm` | Abre o wizard de cadastro do CRM, pré-preenchido | c2-wizard-abrir |
| ação | `wizard.preencher` | Preenche os campos de configuração com os valores do workspace | c2-wizard-preencher |
| ação | `wizard.testar` | Roda as 4 checagens em sequência, cada uma com ícone e tempo | c2-wizard-teste |
| ação | `wizard.descobrir` | Executa a descoberta e mostra os objetos com PII mascarada | c2-wizard-descoberta |
| ação | `wizard.concluir` | Conclui o cadastro; o conector aparece como Conectado em Dev | c2-wizard-concluir |
| ação | `openapi.importar-exemplo` | Importa a especificação OpenAPI de exemplo e mostra as tools geradas | c2-openapi |

## `/dados`

| Tipo | Id | O que é / o que faz | Passos |
|---|---|---|---|
| alvo | `dados-dominio-cliente` | Domínio Cliente na lista de domínios (camadas, dono, qualidade) | c3-dominio |
| alvo | `contrato-visual` | Contrato do domínio Cliente na visão visual | c3-contrato-visual |
| alvo | `contrato-campo-usado` | Campo do contrato usado por uma jornada em Prd | c3-remover-campo |
| alvo | `contrato-publicar` | Botão "Publicar" do contrato e, após a tentativa, o painel de bloqueio com o impacto | c3-bloqueio |
| ação | `dados.abrir-contrato` | Abre o contrato do domínio Cliente na visão visual | c3-contrato-visual |
| ação | `contrato.remover-campo-usado` | Remove do rascunho o campo usado por jornada em Prd | c3-remover-campo |
| ação | `contrato.tentar-publicar` | Tenta publicar; a publicação é bloqueada e o impacto (jornadas, canais) aparece | c3-bloqueio |

## `/conhecimento`

| Tipo | Id | O que é / o que faz | Passos |
|---|---|---|---|
| alvo | `conhecimento-pergunta` | Campo de pergunta à base e, após responder, o trecho recuperado com a fonte | c3-pergunta |
| ação | `conhecimento.perguntar` | Faz a pergunta de exemplo do workspace e mostra o trecho da política com a fonte | c3-pergunta |

## `/cerebro`

| Tipo | Id | O que é / o que faz | Passos |
|---|---|---|---|
| alvo | `cerebro-mapa` | Mapa do cérebro (áreas, regras, conhecimento e componentes) | c4-mapa |
| alvo | `regra-tabela` | Tabela de decisão da regra do setor | c4-regra |
| alvo | `regra-testar` | Painel "Testar caso" da regra | c4-testar |
| alvo | `regra-publicar` | Botão "Publicar como componente" da regra | c4-publicar |
| ação | `cerebro.acender` | Acende o mapa área por área com o que foi conectado e organizado | c4-mapa |
| ação | `regra.abrir` | Abre a tabela de decisão da regra do setor | c4-regra |
| ação | `regra.testar-caso` | Roda um caso de teste e destaca a linha da tabela que decidiu | c4-testar |
| ação | `regra.publicar` | Publica a regra como componente Rule no catálogo | c4-publicar |

## `/catalogo`

| Tipo | Id | O que é / o que faz | Passos |
|---|---|---|---|
| alvo | `catalogo-componente` | Detalhe do componente Rule recém-publicado (versão, consumidores, aprovação do CoE AI) | c4-catalogo |

## `/iniciativas`

| Tipo | Id | O que é / o que faz | Passos |
|---|---|---|---|
| alvo | `iniciativa-nova` | Botão/formulário "Nova iniciativa" | c5-nova-ideia |
| alvo | `iniciativa-validar` | Botão "Validar no cérebro" | c5-validar |
| alvo | `validacao-relatorio` | Relatório com as 8 checagens (verde/amarelo/vermelho), % de reuso e lacunas | c5-relatorio |
| alvo | `validacao-seguir` | Botões "Seguir" e "Rever" do patrocinador; após Seguir, o protótipo de conversa | c5-seguir |
| alvo | `gerar-jornada` | Botão "Gerar jornada" | c5-gerar-jornada |
| ação | `iniciativa.registrar-ideia` | Registra a ideia de exemplo do setor | c5-nova-ideia |
| ação | `iniciativa.validar` | Roda as 8 checagens em sequência, com a fonte no cérebro | c5-validar |
| ação | `iniciativa.seguir` | Clica em "Seguir"; o protótipo de conversa aparece | c5-seguir |
| ação | `iniciativa.gerar-jornada` | Gera a jornada e abre o rascunho em /jornadas/studio | c5-gerar-jornada |

## `/jornadas/studio`

| Tipo | Id | O que é / o que faz | Passos |
|---|---|---|---|
| alvo | `studio-canvas` | Canvas do fluxo (caixinhas ligadas) | c5-studio |
| alvo | `studio-testar` | Botão "Testar com persona" | c5-testar |
| alvo | `studio-problemas` | Painel de problemas da validação (ex.: PII indo ao canal sem filtro) | — |
| alvo | `studio-corrigir-pii` | Ação "Inserir filtro de PII" no problema apontado | c5-corrigir-pii |
| alvo | `studio-promover` | Botão "Promover" (Dev → Hml) | — |
| alvo | `promocao-gates` | Painel de gates da promoção, preenchendo-se um a um | c5-promover-hml |
| alvo | `studio-construir` | Botão "Enviar para construção" | c6-enviar-construcao |
| alvo | `studio-progresso` | Indicador de progresso da construção (OC) sobre o canvas, nó a nó, com PR e evidências ao final | c6-studio-acende |
| alvo | `promocao-prd` | Ação "Promover para Prd" e o gate que a bloqueia, com o motivo | c7-tentar-prd |
| ação | `studio.testar` | Roda o teste com a persona; a validação acusa PII sem filtro | c5-testar |
| ação | `studio.corrigir-pii` | Insere o nó de filtro de PII e reexecuta o teste (passa) | c5-corrigir-pii |
| ação | `studio.promover-hml` | Promove de Dev para Hml, preenchendo os gates na tela | c5-promover-hml |
| ação | `studio.enviar-construcao` | Gera o pacote de construção (OC) para ser executado no Claude Code | c6-enviar-construcao |
| ação | `studio.simular-construcao` | Acende o canvas nó a nó como se a construção estivesse em andamento (plano B; usa OC já construída) | c6-studio-acende |
| ação | `promocao.tentar-prd` | Tenta promover para Prd sem aprovação do dono de negócio; o gate bloqueia | c7-tentar-prd |

## `/canais`

| Tipo | Id | O que é / o que faz | Passos |
|---|---|---|---|
| alvo | `canais-whatsapp` | Cartão do canal WhatsApp e o vínculo com a jornada promovida | c6-plugar-whatsapp |
| alvo | `canal-simulador` | Simulador de conversa do canal | c6-simulador |
| ação | `canal.plugar-whatsapp` | Pluga o WhatsApp na jornada promovida (Hml) | c6-plugar-whatsapp |
| ação | `canal.enviar-mensagem` | Envia a mensagem de exemplo do cliente fictício e mostra a resposta da jornada | c6-simulador |

## `/ambientes`

| Tipo | Id | O que é / o que faz | Passos |
|---|---|---|---|
| alvo | `ambientes-pipeline` | Esteira Dev → Hml → Prd com a jornada e seus gates | c6-ambientes |

## `/ides`

| Tipo | Id | O que é / o que faz | Passos |
|---|---|---|---|
| alvo | `ides-conexao` | Cartão da IDE conectada ao MCP do Córtex (status, ferramentas, última chamada) | c6-ides |

## `/governanca`

| Tipo | Id | O que é / o que faz | Passos |
|---|---|---|---|
| alvo | `governanca-aprovacoes` | Fila de aprovações pendentes, com a promoção para Prd | c7-aprovar |
| ação | `governanca.aprovar` | Aprova a promoção para Prd como dono de negócio | c7-aprovar |

## `/telemetria`

| Tipo | Id | O que é / o que faz | Passos |
|---|---|---|---|
| alvo | `telemetria-trace` | Trace de uma execução com o guardrail acionado destacado | c7-trace |
| alvo | `sugestao-aceitar` | Cartão de sugestão do cérebro com o botão "Aceitar" | c7-sugestao |
| ação | `telemetria.abrir-trace-guardrail` | Abre o trace de uma execução em que o guardrail agiu | c7-trace |
| ação | `sugestao.aceitar` | Aceita a sugestão; o rascunho da skill é criado no Catálogo | c7-sugestao |

## `/encerramento`

| Tipo | Id | O que é / o que faz | Passos |
|---|---|---|---|
| alvo | `encerramento-semear` | Coluna/etapa "Semear" | c8-semear |
| alvo | `encerramento-provar` | Coluna/etapa "Provar" | c8-provar |
| alvo | `encerramento-escalar` | Coluna/etapa "Escalar" | c8-escalar |
| alvo | `encerramento-plano` | Próximo passo em aberto e a tabela "Do mock à versão inicial" | c8-proximo-passo |

## Passos por capítulo

### 0 · Abertura — Seleção de workspace

| Passo | Rota | Alvo | Ação | Avanço |
|---|---|---|---|---|
| `c0-boas-vindas` (restaura `chapter-0`) | `/` | `ws-cards` | — | `next` |
| `c0-escolher-workspace` | `/` | `ws-cards` | `ws.escolher-anchor` | `action:ws.escolher-anchor` |

### 1 · As ilhas — Mapa do ecossistema

| Passo | Rota | Alvo | Ação | Avanço |
|---|---|---|---|---|
| `c1-ilhas` (restaura `chapter-1`) | `/cockpit` | `cockpit-ecossistema` | — | `next` |
| `c1-custo-das-ilhas` | `/cockpit` | `cockpit-kpis` | — | `next` |

### 2 · Conectar — Conectores

| Passo | Rota | Alvo | Ação | Avanço |
|---|---|---|---|---|
| `c2-galeria` (restaura `chapter-2`) | `/conectores` | `conectores-galeria` | — | `next` |
| `c2-wizard-abrir` | `/conectores` | `conector-card-crm` | `wizard.abrir-crm` | `action:wizard.abrir-crm` |
| `c2-wizard-preencher` | `/conectores` | `wizard-passo-config` | `wizard.preencher` | `action:wizard.preencher` |
| `c2-wizard-teste` | `/conectores` | `wizard-passo-teste` | `wizard.testar` | `action:wizard.testar` |
| `c2-wizard-descoberta` | `/conectores` | `wizard-descoberta` | `wizard.descobrir` | `action:wizard.descobrir` |
| `c2-wizard-concluir` | `/conectores` | `wizard-concluir` | `wizard.concluir` | `action:wizard.concluir` |
| `c2-openapi` | `/conectores` | `openapi-importar` | `openapi.importar-exemplo` | `action:openapi.importar-exemplo` |

### 3 · Organizar — Dados e Conhecimento

| Passo | Rota | Alvo | Ação | Avanço |
|---|---|---|---|---|
| `c3-dominio` (restaura `chapter-3`) | `/dados` | `dados-dominio-cliente` | — | `next` |
| `c3-contrato-visual` | `/dados` | `contrato-visual` | `dados.abrir-contrato` | `action:dados.abrir-contrato` |
| `c3-remover-campo` | `/dados` | `contrato-campo-usado` | `contrato.remover-campo-usado` | `action:contrato.remover-campo-usado` |
| `c3-bloqueio` | `/dados` | `contrato-publicar` | `contrato.tentar-publicar` | `action:contrato.tentar-publicar` |
| `c3-pergunta` | `/conhecimento` | `conhecimento-pergunta` | `conhecimento.perguntar` | `action:conhecimento.perguntar` |

### 4 · O cérebro — Mapa do cérebro e Catálogo

| Passo | Rota | Alvo | Ação | Avanço |
|---|---|---|---|---|
| `c4-mapa` (restaura `chapter-4`) | `/cerebro` | `cerebro-mapa` | `cerebro.acender` | `action:cerebro.acender` |
| `c4-regra` | `/cerebro` | `regra-tabela` | `regra.abrir` | `action:regra.abrir` |
| `c4-testar` | `/cerebro` | `regra-testar` | `regra.testar-caso` | `action:regra.testar-caso` |
| `c4-publicar` | `/cerebro` | `regra-publicar` | `regra.publicar` | `action:regra.publicar` |
| `c4-catalogo` | `/catalogo` | `catalogo-componente` | — | `next` |

### 5 · Criar — Iniciativas e Studio

| Passo | Rota | Alvo | Ação | Avanço |
|---|---|---|---|---|
| `c5-nova-ideia` (restaura `chapter-5`) | `/iniciativas` | `iniciativa-nova` | `iniciativa.registrar-ideia` | `action:iniciativa.registrar-ideia` |
| `c5-validar` | `/iniciativas` | `iniciativa-validar` | `iniciativa.validar` | `action:iniciativa.validar` |
| `c5-relatorio` | `/iniciativas` | `validacao-relatorio` | — | `next` |
| `c5-seguir` | `/iniciativas` | `validacao-seguir` | `iniciativa.seguir` | `action:iniciativa.seguir` |
| `c5-gerar-jornada` | `/iniciativas` | `gerar-jornada` | `iniciativa.gerar-jornada` | `action:iniciativa.gerar-jornada` |
| `c5-studio` | `/jornadas/studio` | `studio-canvas` | — | `next` |
| `c5-testar` | `/jornadas/studio` | `studio-testar` | `studio.testar` | `action:studio.testar` |
| `c5-corrigir-pii` | `/jornadas/studio` | `studio-corrigir-pii` | `studio.corrigir-pii` | `action:studio.corrigir-pii` |
| `c5-promover-hml` | `/jornadas/studio` | `promocao-gates` | `studio.promover-hml` | `action:studio.promover-hml` |

### 6 · Entregar — Canais, Ambientes e IDEs & MCP

| Passo | Rota | Alvo | Ação | Avanço |
|---|---|---|---|---|
| `c6-plugar-whatsapp` (restaura `chapter-6`) | `/canais` | `canais-whatsapp` | `canal.plugar-whatsapp` | `action:canal.plugar-whatsapp` |
| `c6-simulador` | `/canais` | `canal-simulador` | `canal.enviar-mensagem` | `action:canal.enviar-mensagem` |
| `c6-ambientes` | `/ambientes` | `ambientes-pipeline` | — | `next` |
| `c6-ides` | `/ides` | `ides-conexao` | — | `next` |
| `c6-enviar-construcao` | `/jornadas/studio` | `studio-construir` | `studio.enviar-construcao` | `action:studio.enviar-construcao` |
| `c6-studio-acende` | `/jornadas/studio` | `studio-progresso` | `studio.simular-construcao` | `action:studio.simular-construcao` |

### 7 · Governar e medir — Governança, Telemetria e Cockpit

| Passo | Rota | Alvo | Ação | Avanço |
|---|---|---|---|---|
| `c7-tentar-prd` (restaura `chapter-7`) | `/jornadas/studio` | `promocao-prd` | `promocao.tentar-prd` | `action:promocao.tentar-prd` |
| `c7-ver-como` | `/governanca` | `ver-como` | `vercomo.dono-negocio` | `action:vercomo.dono-negocio` |
| `c7-aprovar` | `/governanca` | `governanca-aprovacoes` | `governanca.aprovar` | `action:governanca.aprovar` |
| `c7-trace` | `/telemetria` | `telemetria-trace` | `telemetria.abrir-trace-guardrail` | `action:telemetria.abrir-trace-guardrail` |
| `c7-sugestao` | `/telemetria` | `sugestao-aceitar` | `sugestao.aceitar` | `action:sugestao.aceitar` |
| `c7-antes-depois` | `/cockpit` | `cockpit-antes-depois` | `cockpit.alternar` | `action:cockpit.alternar` |

### 8 · Como começamos — Encerramento

| Passo | Rota | Alvo | Ação | Avanço |
|---|---|---|---|---|
| `c8-semear` (restaura `chapter-8`) | `/encerramento` | `encerramento-semear` | — | `next` |
| `c8-provar` | `/encerramento` | `encerramento-provar` | — | `next` |
| `c8-escalar` | `/encerramento` | `encerramento-escalar` | — | `next` |
| `c8-proximo-passo` | `/encerramento` | `encerramento-plano` | — | `next` |

