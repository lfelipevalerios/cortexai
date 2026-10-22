---
description: Roda as oito checagens de validação de uma iniciativa do Córtex (estratégia, mercado e regulação, regras de negócio, dados, integrações e canais, arquitetura, reuso, business case) consultando o cérebro, e registra o relatório com fontes. Use quando pedirem para validar uma iniciativa ou ideia no Córtex.
argument-hint: "[id-da-iniciativa]"
disable-model-invocation: true
allowed-tools: mcp__plugin_cortex_cortex__obter_iniciativa mcp__plugin_cortex_cortex__buscar_regra mcp__plugin_cortex_cortex__obter_contrato mcp__plugin_cortex_cortex__listar_componentes mcp__plugin_cortex_cortex__consultar_conhecimento mcp__plugin_cortex_cortex__validar_contra_padroes
---

# /cortex:validar — validar uma iniciativa

Iniciativa: `$ARGUMENTS` (se vazio, chame `obter_iniciativa` sem id, liste e pergunte qual validar).

Cada checagem termina em **verde**, **amarelo** ou **vermelho**, com um resumo de uma ou duas frases e a **fonte** no cérebro (id ou URI `cortex://...`). Sem fonte não há verde: falta de evidência é amarelo. Não invente números; use os do cérebro e da iniciativa.

## 1. Contexto

Chame `obter_iniciativa({ id })`: problema, objetivo, métrica, valor esperado, domínio, jornada e casos de teste. Leia o índice `cortex://<workspace>/indice` para saber o que existe no cérebro.

## 2. As oito checagens (`key` entre parênteses)

1. **Estratégia** (`estrategia`): a iniciativa serve a um objetivo estratégico? Use `consultar_conhecimento` com o objetivo e leia os artefatos de negócio (`cortex://.../negocio/...`). Verde se há objetivo explícito e a métrica da iniciativa o move.
2. **Mercado e regulação** (`mercado`): normas, prazos regulatórios, concorrência. Use `consultar_conhecimento` (fichas de mercado, documentos regulatórios) e `buscar_regra` pela norma. Vermelho se a iniciativa contraria uma regra regulatória.
3. **Regras de negócio** (`regras`): as decisões da iniciativa já existem como tabelas de decisão? Use `buscar_regra` para cada decisão. Verde se todas existem; amarelo se falta alguma (liste quais).
4. **Dados** (`dados`): as entidades necessárias têm contrato publicado? Use `obter_contrato` por entidade. Aponte campos `pii` e a qualidade (`lastResult`). Amarelo para contrato em rascunho ou regra de qualidade em falha; vermelho se a entidade central não tem contrato.
5. **Integrações e canais** (`integracoes`): os sistemas e canais necessários estão conectados? Procure tools e conectores com `listar_componentes` (`tipo: "mcp"`) e `consultar_conhecimento`. Amarelo para conector degradado ou ausente.
6. **Arquitetura** (`arquitetura`): a solução cabe na arquitetura de referência, nos ADRs e na stack aprovada? Leia os recursos `padroes` e `adrs`, e rode `validar_contra_padroes({ descricao })` com a solução proposta. Vermelho se depende de algo do anel *Evitar* ou proibido por política.
7. **Reuso** (`reuso`): quanto da solução sai de componentes homologados? Use `listar_componentes` (`status: "homologado"`). Calcule `reusePct` = peças reutilizáveis ÷ peças necessárias × 100 (arredonde e explique a conta no resumo).
8. **Business case** (`business_case`): o valor esperado (`expectedValueBRL`) e a métrica são plausíveis frente ao baseline do cérebro? Amarelo se falta baseline; vermelho se o custo estimado supera o valor.

## 3. Recomendação

- `solutionType`: `agente`, `automacao`, `aplicacao`, `integracao` ou `produto_de_dados`;
- `recommendation`: uma frase objetiva ("Seguir como agente supervisionado reutilizando X e Y");
- `attention`: lista curta dos pontos amarelos e vermelhos com a ação sugerida;
- `decision`: só preencha se a pessoa decidir (`seguir` ou `rever`). Caso contrário, omita.

## 4. Registrar

Chame `registrar_validacao({ iniciativaId, validacao })` com:

```json
{
  "checks": [
    { "key": "estrategia", "label": "Estratégia", "result": "verde", "summary": "…", "source": "cortex://ws-…/negocio/…" },
    { "key": "mercado", "label": "Mercado e regulação", "result": "amarelo", "summary": "…", "source": "…" },
    { "key": "regras", "label": "Regras de negócio", "result": "verde", "summary": "…", "source": "…" },
    { "key": "dados", "label": "Dados", "result": "verde", "summary": "…", "source": "…" },
    { "key": "integracoes", "label": "Integrações e canais", "result": "verde", "summary": "…", "source": "…" },
    { "key": "arquitetura", "label": "Arquitetura", "result": "verde", "summary": "…", "source": "…" },
    { "key": "reuso", "label": "Reuso", "result": "verde", "summary": "…", "source": "…" },
    { "key": "business_case", "label": "Business case", "result": "amarelo", "summary": "…", "source": "…" }
  ],
  "recommendation": "…",
  "attention": ["…"],
  "reusePct": 70,
  "solutionType": "agente"
}
```

Se a resposta indicar `checagensFaltando`, complete e registre de novo. No fim, mostre à pessoa uma tabela das oito checagens com resultado e fonte, a recomendação e os pontos de atenção.
