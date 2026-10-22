---
description: Gera um protótipo navegável de uma iniciativa ou jornada do Córtex a partir da especificação (roteiro de conversa, telas, textos e tokens de design) e registra o link na iniciativa. Use quando pedirem para prototipar uma jornada ou iniciativa do Córtex.
argument-hint: "[id-da-OC | id-da-iniciativa]"
disable-model-invocation: true
allowed-tools: mcp__plugin_cortex_cortex__obter_ordem mcp__plugin_cortex_cortex__obter_iniciativa mcp__plugin_cortex_cortex__buscar_regra mcp__plugin_cortex_cortex__obter_contrato mcp__plugin_cortex_cortex__listar_componentes mcp__plugin_cortex_cortex__consultar_conhecimento mcp__plugin_cortex_cortex__validar_contra_padroes mcp__plugin_cortex_cortex__registrar_progresso
---

# /cortex:prototipar — protótipo navegável

Alvo: `$ARGUMENTS`

A prototipação segue o mesmo fluxo da construção (`/cortex:construir`) com uma definição de pronto mais leve: **protótipo navegável e revisão visual**, sem suíte completa de testes, sem integração real e sem PR obrigatório.

## Fluxo

1. **Especificação.**
   - Se o argumento for uma OC (`oc-...`), chame `obter_ordem({ ordemId })`.
   - Se for uma iniciativa, chame `obter_iniciativa({ id })` e, se ela tiver jornada, `obter_ordem({ jornadaId })`. Sem OC, trabalhe com a iniciativa e as regras e contratos que `buscar_regra` e `obter_contrato` devolverem.
   - Extraia persona, roteiro de conversa (gatilho → respostas por nó), textos, regras de decisão e campos de dados exibidos.
2. **Experiência.** Leia os recursos de padrões (`cortex://.../padroes/...`) para tokens de design (cores, tipografia, tom de voz). Na falta, use o tema escuro do Córtex: fundo `#0B0B12`, roxo `#A07EFC`, verde `#00FF95`, amarelo `#F9D718`.
3. **Plano curto** (máximo 5 passos). Mostre à pessoa e peça um ok antes de gerar. Se houver OC, registre com `registrar_plano`.
4. **Gerar o protótipo** em `prototipos/<id>/` como página estática (HTML + CSS + JS sem build, ou o framework do repositório se já houver um):
   - simulador do canal (moldura de celular para WhatsApp/app, janela para web chat, painel para backoffice);
   - a conversa roda o roteiro: cada etapa mostra a resposta e, num painel lateral recolhível, o nó da jornada e a regra aplicada (como o trace do Córtex);
   - **dados sintéticos** coerentes com o contrato, com CPF e e-mail sempre mascarados na tela (`***.123.456-**`);
   - decisões seguem as linhas reais das tabelas de decisão, sem lógica inventada.
5. **Checar** os arquivos gerados com `validar_contra_padroes` e corrigir.
6. **Progresso.** Se houver OC, chame `registrar_progresso` para cada nó representado no protótipo.
7. **Entregar.** Sirva localmente (por exemplo `npx serve prototipos/<id>`) ou publique onde o projeto já publica protótipos, e registre o link com `registrar_evidencia({ ordemId, tipo: "outro", evidencia: "Protótipo navegável: <url>" })`. O link aparece na iniciativa.
8. **Responder** com o link, como navegar e o que ficou fora do protótipo.

## Limites

- Não altere regra, contrato nem jornada. Lacunas viram `propor_mudanca`.
- Nada de chave de API, segredo ou chamada a sistema real no protótipo.
