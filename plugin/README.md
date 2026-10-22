# Plugin do Córtex para o Claude Code

Esta pasta é um **marketplace de plugins** do Claude Code (`.claude-plugin/marketplace.json`) com um plugin, `cortex`. O plugin leva o catálogo homologado do Córtex para dentro do Claude Code:

| Catálogo do Córtex | No plugin | Arquivo |
|---|---|---|
| MCP | Servidor MCP do Córtex (HTTP), com token pessoal | `cortex/.mcp.json` |
| Pacote → comandos | `/cortex:desenhar`, `/cortex:validar`, `/cortex:prototipar`, `/cortex:construir`, `/cortex:perguntar` | `cortex/skills/<nome>/SKILL.md` |
| Rule | Skill `padroes-do-projeto` (as regras são lidas dos recursos MCP, não copiadas) | `cortex/skills/padroes-do-projeto/SKILL.md` |
| Agent | Subagentes `cortex:implementador`, `cortex:testador`, `cortex:revisor-padroes` | `cortex/agents/*.md` |
| Hook | Bloqueia código que registra em log ou devolve CPF/e-mail sem máscara | `cortex/hooks/hooks.json` + `checar-pii.mjs` |

Os comandos são skills (o formato que a documentação atual recomenda no lugar de `commands/`); o Claude Code os expõe como `/cortex:<pasta-da-skill>`.

## Pré-requisitos

- Claude Code instalado e **logado com a sua própria licença** (Pro, Max, Team ou Enterprise).
- **`ANTHROPIC_API_KEY` não pode estar definida.** Com ela definida, o Claude Code cobra pela API em vez de usar a licença. Confira com `echo $ANTHROPIC_API_KEY` (bash) ou `echo $env:ANTHROPIC_API_KEY` (PowerShell) e remova se aparecer algo. O modo `--bare` também não usa a licença e fica fora do protótipo.
- Node.js 18 ou mais recente no `PATH` (o hook roda `node`).
- Servidor MCP do Córtex no ar (`pnpm mcp` na raiz do monorepo, porta 8787). Veja `apps/mcp-server/README.md`.

## Instalação

Dentro de uma sessão do Claude Code:

```text
/plugin marketplace add ./plugin
/plugin install cortex@cortex-marketplace
```

Ou pelo terminal:

```bash
claude plugin marketplace add ./plugin
claude plugin install cortex@cortex-marketplace
```

O caminho pode ser absoluto ou o repositório git (`claude plugin marketplace add <org>/<repo>`, quando o marketplace estiver na raiz do repositório). Depois de instalar, reinicie a sessão ou rode `/reload-plugins`, e confira com `/mcp` (servidor `plugin:cortex:cortex`) e `/` (comandos `/cortex:*`).

Para desenvolver o plugin sem marketplace: `claude --plugin-dir ./plugin/cortex`.

## Variáveis de ambiente

| Variável | Padrão | Uso |
|---|---|---|
| `CORTEX_MCP_URL` | `http://localhost:8787/mcp` | URL do servidor MCP do Córtex |
| `CORTEX_TOKEN` | `ctx_ws-telecom_dev_demo` | Token pessoal gerado na tela "IDEs & MCP" do Córtex (`ctx_<workspace>_<env>_<projeto>` no protótipo) |

O `.mcp.json` do plugin usa `${CORTEX_MCP_URL:-…}` e `${CORTEX_TOKEN:-…}`. A documentação do Claude Code confirma a expansão de `${VAR}` e `${VAR:-padrão}` em `url` e `headers` de servidores HTTP, inclusive em plugins. Defina as variáveis **antes** de abrir o Claude Code:

```bash
export CORTEX_TOKEN=ctx_ws-saude_dev_meu-projeto      # bash/zsh
$env:CORTEX_TOKEN = "ctx_ws-saude_dev_meu-projeto"     # PowerShell
```

Observações:

- O Claude Code lê como vazias, em `url` e `headers` remotos, algumas variáveis de credencial conhecidas (por exemplo `ANTHROPIC_API_KEY` e `NPM_TOKEN`), para que um plugin não as envie a terceiros. `CORTEX_TOKEN` não é uma delas. Se o servidor responder 401 com o token certo, confira em `/mcp` se a variável foi expandida.
- O padrão `ctx_ws-telecom_dev_demo` existe só para a demo funcionar "com login e um comando". Na adoção real, remova o padrão do `.mcp.json` ou declare um `userConfig` sensível no `plugin.json` (o valor fica no cofre do sistema) e use `${user_config.cortex_token}` no header.

## Comandos

| Comando | O que o Claude faz | O que volta para o Córtex |
|---|---|---|
| `/cortex:desenhar <descrição>` | Lê o cérebro e compõe a jornada só com componentes, regras e contratos existentes | `salvar_rascunho_jornada`: rascunho no Studio |
| `/cortex:validar <iniciativa>` | Roda as 8 checagens (estratégia, mercado e regulação, regras, dados, integrações e canais, arquitetura, reuso, business case) | `registrar_validacao`: relatório com fontes |
| `/cortex:prototipar <OC ou iniciativa>` | Gera protótipo navegável a partir da especificação e dos tokens de design | `registrar_progresso` + link em `registrar_evidencia` |
| `/cortex:construir <OC>` | Plano → aprovação → branch → nó a nó com subagentes e `validar_contra_padroes` → testes dos casos do Studio → PR | `registrar_plano`, `registrar_progresso` por nó, `registrar_evidencia` com PR; `propor_mudanca` se o desenho precisar mudar |
| `/cortex:perguntar <pergunta>` | Responde sobre o workspace citando as fontes | Telemetria da consulta |

## Hook de política (PII)

`hooks/hooks.json` registra um `PreToolUse` para `Edit|Write|MultiEdit` que roda `node ${CLAUDE_PLUGIN_ROOT}/hooks/checar-pii.mjs` na forma exec (`command` + `args`), o que funciona igual em Windows, macOS e Linux. O script lê o JSON do stdin (`tool_name`, `tool_input.file_path`, `tool_input.content` ou `new_string`), olha só arquivos de código e, se uma linha nova registra em log ou devolve na resposta CPF, e-mail, telefone etc. sem mascaramento, **sai com código 2** e escreve o motivo no stderr. Pela semântica documentada dos hooks, o código 2 bloqueia a ferramenta e o stderr volta para o Claude, que corrige e tenta de novo. Qualquer erro interno do script sai com 0 para não travar o trabalho. Exceção pontual: comentário `cortex-allow-pii` na linha.

Teste manual:

```bash
echo '{"tool_name":"Write","tool_input":{"file_path":"/tmp/a.ts","content":"logger.info(cliente.cpf)"}}' | node plugin/cortex/hooks/checar-pii.mjs; echo "exit=$?"   # exit=2
```

## Validação

O pipeline de publicação do Córtex roda `claude plugin validate ./plugin` (marketplace) e `claude plugin validate ./plugin/cortex` (plugin) antes de liberar cada versão. Avisos esperados: o validador pode sinalizar `http://` (só para hosts que não são loopback) e o token padrão do header, que parece credencial literal.

## Critérios da prova de viabilidade (seção 9)

- [ ] O Claude Code instala o plugin do projeto e conecta ao MCP do Córtex só com login e um comando.
- [ ] A partir apenas do pacote de construção, o Claude implementa uma jornada-âncora com os testes gerados dos casos do Studio passando.
- [ ] Um hook bloqueia uma violação de política durante a construção, e o Claude corrige sem intervenção.
- [ ] O progresso acende no Studio nó a nó, e a OC termina com PR e evidências.
- [ ] A telemetria do Claude Code aparece no Córtex associada à OC.
- [ ] Tudo roda dentro da licença do usuário, sem chave de API.

Roteiro sugerido para a demo: `pnpm mcp` → abrir o Claude Code no repositório da solução → `/cortex:construir <OC da jornada-âncora>` → aprovar o plano → acompanhar as caixinhas no Studio → o hook bloqueia um `logger.info(cliente.cpf)` e o Claude corrige sozinho → PR e evidências na OC.
