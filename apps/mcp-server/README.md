# Servidor MCP do Córtex

Servidor MCP real (SDK oficial `@modelcontextprotocol/sdk`, transporte **Streamable HTTP**) que expõe o cérebro do Córtex para o Claude Code, o Cursor e outras IDEs agênticas. Lê os mesmos dados do `@cortex/seed` que a aplicação web e guarda as escritas em memória (reiniciar o servidor volta ao estado do seed).

## Como rodar

```bash
pnpm install                                # na raiz do monorepo
pnpm mcp                                    # atalho da raiz = pnpm --filter @cortex/mcp-server start
# ou
pnpm --filter @cortex/mcp-server start      # http://127.0.0.1:8787/mcp
pnpm --filter @cortex/mcp-server smoke      # teste de fumaça com o cliente oficial do SDK
pnpm --filter @cortex/mcp-server typecheck
```

| Variável | Padrão | Uso |
|---|---|---|
| `PORT` | `8787` | Porta HTTP |
| `HOST` | `127.0.0.1` | Interface. Use `0.0.0.0` em contêiner (Azure Container Apps) |
| `CORTEX_ALLOW_ANON` | (vazio) | `1` aceita chamadas sem token, no escopo `CORTEX_ANON_WORKSPACE` (padrão `ws-telecom`) / `CORTEX_ANON_ENV` (padrão `dev`) |

Rotas:

- `POST /mcp`: endpoint MCP (Streamable HTTP, **modo sem sessão**: cada requisição cria um servidor com o escopo do token). `GET` e `DELETE /mcp` respondem `405`, como recomenda o SDK para o modo sem sessão; os clientes MCP tratam isso normalmente.
- `GET /health`: estado do servidor, workspaces carregados e se o seed está vazio.
- `GET /events?since=<ISO>`: feed de telemetria e escritas do workspace do token (mesmo conteúdo da ferramenta `obter_telemetria`), para a tela de IDEs e a telemetria do Córtex.

## Token pessoal

Header `Authorization: Bearer <token>`. No protótipo o token é legível e carrega o escopo:

```
ctx_<workspaceId>_<dev|hml|prd>_<projeto>
ex.: ctx_ws-telecom_dev_demo  →  workspace ws-telecom, ambiente dev, projeto demo
```

Token ausente ou fora do formato devolve `401`. Com o seed carregado, um workspace inexistente também devolve `401`. As ferramentas de leitura só veem o workspace do token; OCs e políticas são filtradas pelo ambiente; `salvar_rascunho_jornada` só é aceita em `dev`.

## Configurar a IDE

**Claude Code** (sintaxe conferida na documentação atual de MCP do Claude Code; `--transport` antes do nome, `--header` depois da URL):

```bash
claude mcp add --transport http cortex http://localhost:8787/mcp --header "Authorization: Bearer ctx_ws-telecom_dev_demo"
```

Para não gravar o token no arquivo de configuração, use uma variável de ambiente (expandida quando a configuração carrega):

```bash
export CORTEX_TOKEN=ctx_ws-telecom_dev_demo
claude mcp add --transport http cortex http://localhost:8787/mcp --header "Authorization: Bearer \${CORTEX_TOKEN}"
```

Use `--scope project` para gravar em `.mcp.json` no repositório (compartilhado com o time). Confira com `claude mcp list` ou `/mcp` dentro da sessão. Com o plugin do Córtex instalado (`plugin/`), esta etapa não é necessária: o plugin já declara o servidor.

**Cursor** (`.cursor/mcp.json` no projeto ou `~/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "cortex": {
      "url": "http://localhost:8787/mcp",
      "headers": { "Authorization": "Bearer ctx_ws-telecom_dev_demo" }
    }
  }
}
```

## O que o servidor expõe

**Recursos** (`cortex://<workspaceId>/<tipo>/<id>`, template `cortex://{workspaceId}/{kind}/{id}` + índice `cortex://<workspaceId>/indice`):

| Tipo | Origem no seed | Formato |
|---|---|---|
| `regras` | `decisionTables` e componentes `rule` | Markdown com a tabela de decisão |
| `padroes` | artefatos das áreas técnicas do cérebro | Markdown |
| `adrs` | artefatos técnicos cujo `kind` é ADR | Markdown |
| `contratos` | `contracts` publicados | YAML no estilo ODCS |
| `documentos` | documentos processados e componentes `documento` homologados | Markdown com os trechos |
| `politicas` | políticas ativas no ambiente do token | Markdown + JSON da regra |

**Ferramentas.** Leitura: `obter_ordem`, `buscar_regra`, `obter_contrato`, `listar_componentes`, `consultar_conhecimento`, `validar_contra_padroes` e `obter_telemetria` (extra, para a demo). Escrita: `registrar_plano`, `registrar_progresso`, `registrar_evidencia`, `propor_mudanca`, `salvar_rascunho_jornada`, `registrar_validacao`, `criar_historia_itsm`.

- `obter_ordem` devolve o pacote de construção completo: OC, iniciativa, jornada e grafo, mapa nó → artefato esperado, regras, contratos ODCS, componentes, casos de teste, políticas e próximos passos. Sem argumentos, devolve a OC mais recente do ambiente (prefere a jornada-âncora).
- `validar_contra_padroes` aplica heurísticas (PII em log/resposta sem máscara, segredo no código, SQL concatenado, stack do anel *Evitar* do radar ou proibida em política de stack) e aponta a regra de origem do workspace (política, Rule ou padrão técnico), com um padrão Córtex como reserva.
- `consultar_conhecimento` usa a recuperação pré-calculada do seed quando a pergunta coincide com a do roteiro e, nas demais, uma busca por palavras-chave nos trechos.

**Prompts:** `implementar_historia` (argumentos `historia`, `ordemId`) e `revisar_codigo` (`codigo`, `caminhoArquivo`).

**Telemetria:** toda chamada de ferramenta, leitura de recurso e prompt gera um evento `{ at, tool, workspaceId, env, project, ok, durationMs }`; toda escrita gera também um evento `escrita` com o objeto alterado. Os eventos ficam em memória (até 5.000) e saem por `obter_telemetria` e `GET /events`.

## Observações

- Seed vazio: o servidor sobe e responde com listas vazias, sem cair. O smoke test injeta uma fixture mínima (`scripts/fixture.ts`) nesse caso para exercitar o caminho de escrita (`SMOKE_FIXTURE=0` desliga).
- Windows com caminho muito longo (mais de 260 caracteres): o `tsx` pode falhar com `spawn ...esbuild.exe ENOENT`. Mova o repositório para um caminho curto, ou aponte `ESBUILD_BINARY_PATH` para uma cópia do `esbuild.exe` em um caminho curto.
