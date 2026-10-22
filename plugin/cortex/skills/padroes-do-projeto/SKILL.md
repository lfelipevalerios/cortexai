---
description: Padrões do projeto definidos no Córtex (regras de negócio, padrões técnicos, ADRs, contratos de dados, políticas e stack aprovada), lidos dos recursos MCP do Córtex. Use sempre que for escrever, revisar ou planejar código, testes ou jornadas num projeto ligado ao Córtex.
user-invocable: true
allowed-tools: mcp__plugin_cortex_cortex__validar_contra_padroes mcp__plugin_cortex_cortex__buscar_regra mcp__plugin_cortex_cortex__obter_contrato mcp__plugin_cortex_cortex__listar_componentes mcp__plugin_cortex_cortex__consultar_conhecimento
---

# Padrões do projeto (Córtex)

As regras deste projeto **não estão escritas aqui**: elas vivem no Córtex e chegam pelo servidor MCP `cortex`, filtradas pelo workspace, projeto e ambiente do token. Assim o código segue sempre a versão homologada, sem cópia desatualizada no repositório.

## Onde ler

| O quê | Recurso MCP | Ferramenta |
|---|---|---|
| Índice de tudo | `cortex://<workspace>/indice` | — |
| Regras de negócio (tabelas de decisão, Rules) | `cortex://<workspace>/regras/<id>` | `buscar_regra` |
| Padrões técnicos | `cortex://<workspace>/padroes/<id>` | — |
| ADRs | `cortex://<workspace>/adrs/<id>` | — |
| Contratos de dados (ODCS) | `cortex://<workspace>/contratos/<id>` | `obter_contrato` |
| Documentos homologados | `cortex://<workspace>/documentos/<id>` | `consultar_conhecimento` |
| Políticas ativas no ambiente | `cortex://<workspace>/politicas/<id>` | — |
| Artefatos de negócio | `cortex://<workspace>/negocio/<id>` | `consultar_conhecimento` |
| Componentes homologados | — | `listar_componentes` |

No Claude Code, os recursos aparecem na menção `@` (servidor `plugin:cortex:cortex`) e podem ser lidos pelas ferramentas de recursos MCP. Leia o índice primeiro e depois só o que a tarefa pede.

## Como aplicar

1. **Antes de codar:** leia as regras, contratos e padrões que a tarefa toca. Implemente a regra de negócio **exatamente** como na tabela de decisão (mesmas entradas, faixas e saídas) e os tipos de dados exatamente como no contrato.
2. **Reuso primeiro:** procure componente homologado (`listar_componentes`, `status: "homologado"`) antes de escrever algo novo.
3. **Durante:** rode `validar_contra_padroes` com o código alterado a cada etapa e corrija todas as violações. Cada violação traz a regra de origem; cite-a ao explicar a correção.
4. **Hooks:** o plugin bloqueia, antes da edição, código que registra em log ou devolve CPF/e-mail sem mascaramento. Quando bloquear, corrija e repita. Não tente contornar o hook.
5. **Divergência:** se a tarefa exigir algo que contraria ou não existe no cérebro, não decida sozinho. Use `propor_mudanca` e avise.

## Base mínima (vale mesmo sem rede)

- Dado pessoal (CPF, e-mail, telefone, cartão) nunca vai para log, mensagem de erro ou canal sem mascaramento ou sem o guardrail de PII.
- Segredos só por variável de ambiente ou cofre; nunca escritos no código nem em teste.
- Consultas SQL sempre parametrizadas.
- Nada do anel *Evitar* do radar de tecnologia.
- Escrita em sistema real só em Dev/sandbox durante a construção; tools de escrita nascem desligadas em Prd.
