---
description: Implementa uma ordem de construção (OC) do Córtex de ponta a ponta (plano, código por nó, testes dos casos do Studio, PR e evidências), seguindo só o que o Córtex definiu. Use quando pedirem para construir ou implementar uma OC ou jornada do Córtex.
argument-hint: "[id-da-OC]"
disable-model-invocation: true
allowed-tools: mcp__plugin_cortex_cortex__obter_ordem mcp__plugin_cortex_cortex__buscar_regra mcp__plugin_cortex_cortex__obter_contrato mcp__plugin_cortex_cortex__listar_componentes mcp__plugin_cortex_cortex__consultar_conhecimento mcp__plugin_cortex_cortex__validar_contra_padroes mcp__plugin_cortex_cortex__registrar_progresso mcp__plugin_cortex_cortex__registrar_evidencia
---

# /cortex:construir — implementar uma ordem de construção

OC pedida: `$ARGUMENTS` (se vazio, use a OC mais recente do ambiente do token).

O Córtex é a fonte da verdade e o Claude Code é o motor que constrói. Tudo o que você precisa está no pacote de construção da OC. Não use requisitos digitados fora do Córtex e não invente regra, campo ou componente.

## Antes de começar

1. Confirme que o servidor MCP `cortex` está conectado (as ferramentas `obter_ordem` etc. estão disponíveis). Se não estiver, peça para a pessoa conferir `CORTEX_MCP_URL` / `CORTEX_TOKEN` e rodar `/mcp`, e pare.
2. Carregue a skill `cortex:padroes-do-projeto` para ter as regras, padrões, ADRs e políticas em mente durante todo o trabalho.

## Fluxo

1. **Ler a OC.** Chame `obter_ordem` com `ordemId: "$ARGUMENTS"` (ou sem argumentos). Guarde: `ordem` (id, repo, branch, env, definitionOfDone), `grafo`, `mapaNoParaArtefato`, `especificacaoFuncional.regras`, `contratos` (ODCS), `componentes`, `casosDeTeste`, `politicas` e `especificacaoTecnica` (padrões, ADRs, stack adotar/evitar). Leia os recursos `cortex://...` citados quando precisar do texto completo.
2. **Montar o plano.** Um passo por nó do grafo (ou grupo coeso de nós), em ordem topológica, indicando o artefato esperado de cada nó, os componentes homologados reutilizados, a regra ou contrato aplicado e os testes. O último passo cobre os testes gerados dos casos de teste e o PR.
3. **Registrar o plano.** Chame `registrar_plano({ ordemId, passos, resumo })`. Se a OC já estava concluída, o Córtex abre uma nova rodada e devolve outro `ordemId` e outra `branch` no campo `aviso`. A partir daí, use os valores devolvidos.
4. **Esperar aprovação.** Mostre o plano e pergunte: "Plano registrado na OC <id>. O Champion AI aprova no Córtex ou aqui. Posso seguir?" **Não escreva código antes de um sim explícito.** Se pedirem ajuste, refaça o plano e registre de novo.
5. **Branch própria.** `git checkout -b <ordem.branch>` a partir da branch principal atualizada. Nunca trabalhe direto na principal.
6. **Implementar nó a nó**, delegando a cada passo ao subagente `cortex:implementador` com o recorte do pacote daquele nó (nó, artefato esperado, regra com a tabela de decisão, contrato, componente e padrões aplicáveis). Para cada nó:
   - antes de criar algo, verifique com `listar_componentes` (status `homologado`) se já existe componente para reutilizar;
   - depois de escrever, rode `validar_contra_padroes` com o código alterado (e `caminhoArquivo`) e corrija **todas** as violações antes de seguir;
   - se o hook do plugin bloquear uma edição (mensagem "Bloqueado pela política do Córtex"), corrija o código conforme a mensagem (por exemplo, mascarando CPF ou e-mail) e repita a edição, sem pedir intervenção;
   - ao concluir o nó, chame `registrar_progresso({ ordemId, nodeId, nota })`. A caixinha acende no Studio.
7. **Testes.** Delegue ao subagente `cortex:testador`: um teste automatizado por item de `casosDeTeste` (entrada `input`, resultado esperado `expected`) e um teste por linha de cada tabela de decisão usada. Rode a suíte e corrija o código até tudo passar. Testes que exigem sistemas externos usam o sandbox de Dev ou dublês baseados no contrato.
8. **Revisão de padrões.** Delegue ao subagente `cortex:revisor-padroes` a revisão do diff completo da branch. Corrija o que ele apontar.
9. **PR.** Commit com mensagem que cite a OC, push da branch e abertura do PR (`gh pr create`) com: OC, jornada e versão, nós implementados, resultado dos testes e checagens de padrões.
10. **Evidências.** Chame `registrar_evidencia` uma vez por evidência:
    - `tipo: "testes"`, ex.: "14/14 testes passaram (8 casos do Studio + 6 linhas de tabela)";
    - `tipo: "validacao"`, ex.: "validar_contra_padroes: 0 violações no diff final";
    - `tipo: "pr"` com `prUrl` (a OC passa a "Pronta para revisão") e, se souber, `tokens`.
11. **Resumo final** para a pessoa: nós construídos x total, testes, PR e pendências.

## Regras inegociáveis

- **Nunca mude o desenho sozinho.** Se faltar um campo no contrato, uma linha na tabela de decisão ou um nó na jornada, chame `propor_mudanca({ alvo, alvoId, motivo, proposta, ordemId })`, avise a pessoa e siga com o que não depende da mudança. Não contorne com valores fixos no código.
- Use só a stack do anel *Adotar* e as decisões dos ADRs. Nada do anel *Evitar*.
- Segredos só por variável de ambiente ou cofre (`secretRef`), nunca escritos no código.
- Dado pessoal nunca vai para log nem para canal sem mascaramento ou sem o guardrail de PII.
- Reutilize componentes homologados antes de escrever código novo; não copie componentes em rascunho.
- O Córtex não chama modelo nenhum: toda a inteligência roda aqui, na licença de quem está logado. Não use `ANTHROPIC_API_KEY`.
