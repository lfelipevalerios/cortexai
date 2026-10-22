---
description: Compõe uma jornada (grafo de nós) a partir de uma descrição em linguagem natural, usando só componentes, regras e contratos do cérebro do Córtex, e salva como rascunho no Studio. Use quando pedirem para desenhar, rascunhar ou montar uma jornada no Córtex.
argument-hint: "<descrição da jornada> [--iniciativa <id>] [--dominio <id>]"
disable-model-invocation: true
allowed-tools: mcp__plugin_cortex_cortex__buscar_regra mcp__plugin_cortex_cortex__obter_contrato mcp__plugin_cortex_cortex__listar_componentes mcp__plugin_cortex_cortex__consultar_conhecimento mcp__plugin_cortex_cortex__obter_iniciativa mcp__plugin_cortex_cortex__validar_contra_padroes
---

# /cortex:desenhar — compor uma jornada a partir de uma descrição

Pedido: $ARGUMENTS

O resultado é um **rascunho** que aparece no Studio do Córtex para ajuste visual. Você compõe com peças que já existem no cérebro; o que não existir vira aviso, não invenção.

## Fluxo

1. **Entender o pedido.** Se houver iniciativa, leia com `obter_iniciativa` (problema, objetivo, métrica, domínio). Identifique gatilho, canal, decisões, dados consultados, ações em sistemas, pontos de pessoa e saída.
2. **Levantar as peças do cérebro:**
   - `listar_componentes` com `status: "homologado"` (e `tipo` agent, skill, mcp, rule) para agentes, skills e tools reutilizáveis;
   - `buscar_regra` para cada decisão de negócio (elegibilidade, prazos, ofertas, alçadas), que vira nó `logica.tabela` ou `conhecimento.regra` com `ruleId`;
   - `obter_contrato` para cada entidade lida ou escrita, que vira nó `dados.produto` com `contractId`. Anote os campos classificados como `pii`;
   - `consultar_conhecimento` quando a jornada responder dúvidas a partir de documentos (nó `conhecimento.buscar`).
3. **Compor o grafo** no formato abaixo. Regras de composição:
   - comece por exatamente um nó de categoria `gatilho` e termine em pelo menos um nó de `saida`;
   - todo nó que expõe dado pessoal ao canal recebe `emitsPii: true`, e **antes** da saída deve haver um `guardrail.pii`;
   - decisões com saídas nomeadas usam `outputs` e as conexões usam `sourceHandle` (`logica.condicao`: "sim"/"não"; `pessoas.aprovacao`: "aprovado"/"reprovado");
   - em jornadas com risco (valores, crédito, saúde) inclua `pessoas.aprovacao` ou `pessoas.transbordo`;
   - preencha `componentId`, `ruleId`, `contractId`, `toolId` e `channelId` **somente** com ids devolvidos pelas ferramentas.
4. **Checar** a descrição do fluxo com `validar_contra_padroes({ descricao })` e ajuste o grafo se houver violação.
5. **Salvar** com `salvar_rascunho_jornada({ nome, descricao, dominioId, tipo, iniciativaId?, jornadaId?, grafo, nota })`. Com `jornadaId` existente, a ferramenta cria nova versão. Só funciona com token do ambiente Dev.
6. **Responder** com: id e versão do rascunho, tabela nó → peça do cérebro usada, avisos devolvidos (componente não homologado, PII sem filtro etc.) e lacunas (o que precisaria existir no cérebro). Para lacunas de regra ou contrato, sugira `propor_mudanca`, sem criar nada.

## Formato do grafo (JourneyGraph)

```json
{
  "nodes": [
    { "id": "n1", "kind": "gatilho.mensagem", "label": "Mensagem no WhatsApp", "channelId": "<id do canal>" },
    { "id": "n2", "kind": "agente.intencao", "label": "Classificar intenção", "componentId": "<id do componente>" },
    { "id": "n3", "kind": "dados.produto", "label": "Ler fatura", "contractId": "<id do contrato>", "emitsPii": true },
    { "id": "n4", "kind": "logica.tabela", "label": "Regra de contestação", "ruleId": "<id da tabela>" },
    { "id": "n5", "kind": "logica.condicao", "label": "Procedente?", "outputs": ["sim", "não"] },
    { "id": "n6", "kind": "guardrail.pii", "label": "Filtro de PII" },
    { "id": "n7", "kind": "saida.responder", "label": "Responder no canal" }
  ],
  "edges": [
    { "source": "n1", "target": "n2" },
    { "source": "n2", "target": "n3" },
    { "source": "n3", "target": "n4" },
    { "source": "n4", "target": "n5" },
    { "source": "n5", "target": "n6", "sourceHandle": "sim" },
    { "source": "n6", "target": "n7" }
  ]
}
```

Campos de nó: `id`, `kind`, `label` (obrigatórios); `category` (derivada do kind se omitida); `position {x,y}` (o Córtex distribui se omitida); `componentId`, `componentVersion`, `ruleId`, `contractId`, `toolId`, `channelId`, `outputs`, `emitsPii`, `config` (mapa texto → texto). Conexões: `source`, `target`, `sourceHandle?`, `label?`, `id?`.

## Kinds permitidos (paleta do Studio)

| Categoria | Kinds |
|---|---|
| gatilho | `gatilho.mensagem` (mensagem de canal), `gatilho.evento`, `gatilho.agendamento`, `gatilho.api`, `gatilho.dado` (mudança de dado) |
| agente | `agente.agente`, `agente.intencao` (classificar intenção), `agente.extrair` (extrair dados), `agente.resumir` |
| conhecimento | `conhecimento.buscar` (buscar na base), `conhecimento.regra` (consultar regra do cérebro) |
| dados | `dados.produto` (ler produto de dados), `dados.tool` (executar ação em sistema), `dados.http`, `dados.mcp` |
| logica | `logica.condicao` (saídas sim/não), `logica.tabela` (tabela de decisão), `logica.dividir`, `logica.paralelo`, `logica.repetir`, `logica.esperar`, `logica.transformar` |
| pessoas | `pessoas.aprovacao` (saídas aprovado/reprovado), `pessoas.transbordo` (para atendente), `pessoas.tarefa` |
| guardrail | `guardrail.pii` (filtro de PII), `guardrail.conteudo`, `guardrail.custo`, `guardrail.fonte` (verificação de fonte) |
| saida | `saida.responder` (no canal), `saida.notificar`, `saida.itsm` (registrar no ITSM), `saida.encerrar` |

Qualquer outro `kind` é rejeitado pelo Córtex.
