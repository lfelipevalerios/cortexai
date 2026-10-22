---
description: Responde perguntas livres sobre o workspace do Córtex (jornadas, regras, contratos, componentes, conectores, políticas, iniciativas, telemetria) consultando o cérebro pelo MCP e citando as fontes. Use quando perguntarem algo sobre o Córtex, o cérebro ou o workspace.
argument-hint: "<pergunta>"
allowed-tools: mcp__plugin_cortex_cortex__obter_ordem mcp__plugin_cortex_cortex__obter_iniciativa mcp__plugin_cortex_cortex__buscar_regra mcp__plugin_cortex_cortex__obter_contrato mcp__plugin_cortex_cortex__listar_componentes mcp__plugin_cortex_cortex__consultar_conhecimento mcp__plugin_cortex_cortex__validar_contra_padroes mcp__plugin_cortex_cortex__obter_telemetria
---

# /cortex:perguntar — pergunte ao Córtex

Pergunta: $ARGUMENTS

Responda **só** com o que o cérebro do Córtex devolver. Esta é a rota das perguntas livres do assistente "Pergunte ao Córtex"; a resposta fica no histórico pela telemetria do MCP.

## Como responder

1. Classifique a pergunta e escolha as ferramentas:
   - regra, política comercial, elegibilidade, prazo → `buscar_regra`;
   - campo, entidade, dado pessoal, qualidade → `obter_contrato`;
   - "existe componente/agente/skill para…", reuso → `listar_componentes`;
   - iniciativa, estágio, validação → `obter_iniciativa`;
   - ordem de construção, progresso, PR → `obter_ordem`;
   - "quem chamou o MCP", uso pela IDE → `obter_telemetria`;
   - documentos, normas, mercado, ADRs, padrões, dúvidas abertas → `consultar_conhecimento` e os recursos `cortex://<workspace>/...` (comece pelo índice `cortex://<workspace>/indice`).
   - "quais jornadas usam X?": cruze os ids devolvidos (`ruleId`, `contractId`, `componentId`) com os grafos de `obter_ordem` e os recursos.
2. Chame quantas ferramentas forem necessárias, de preferência em paralelo.
3. Responda em português, direto ao ponto: primeiro a resposta, depois os detalhes. Cite a fonte de cada afirmação (nome e id ou URI `cortex://`).
4. Se o cérebro não cobre o assunto, diga isso claramente e sugira quem é o dono (campo `owner`/`dono`) ou qual artefato deveria existir. Não complete com conhecimento geral como se fosse do workspace.
5. Perguntas que pedem **ação** (criar conector, mudar regra, promover jornada) não são executadas aqui: explique o caminho no Córtex ou, se for mudança de desenho, ofereça abrir `propor_mudanca` com confirmação da pessoa.
