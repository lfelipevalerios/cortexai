# Córtex — Plano de execução

Fonte: *Hub do Cérebro Agêntico — Plano do protótipo* (21/10/2026). Este documento transforma as 7 ondas da seção 17 em um plano executável, registra as decisões técnicas tomadas na implementação e marca o que já está entregue na branch `pre-prod`.

## 1. Objetivo da entrega

Um protótipo navegável do Córtex, com 13 módulos, 4 workspaces por indústria, 3 ambientes (Dev, Hml, Prd), perfis simulados por "Ver como" e jornada guiada. Ele deve rodar como site estático (modo demonstração, sem backend) e usar a mesma interface de API que o modo conectado vai implementar.

## 2. Arquitetura adotada

```
cortexai/
├─ apps/
│  ├─ web/            Next.js (App Router, export estático) + React + TypeScript + Tailwind
│  └─ mcp-server/     Servidor MCP (SDK oficial, transporte HTTP) lendo o mesmo seed
├─ packages/
│  ├─ schemas/        Tipos e esquemas Zod do modelo de dados (fonte única do contrato)
│  ├─ seed/           Gerador determinístico dos 4 workspaces (semente fixa)
│  ├─ engine/         Motor de jornadas (simulação), políticas e gates de promoção
│  ├─ tour/           Roteiros da jornada guiada (configuração, não código de tela)
│  └─ ui/             Tokens de design (seção 14)
└─ plugin/cortex/     Plugin do Córtex para o Claude Code (skills, agents, hooks, comandos)
```

| Camada | Decisão | Observação |
|---|---|---|
| Monorepo | pnpm workspaces + Turborepo | Como na seção 16 |
| Front-end | Next.js + React + TypeScript, `output: export` | Demo funciona a partir de link estático |
| Interface | Tailwind com os tokens da seção 14, componentes próprios em `apps/web/src/components/ui` | shadcn/ui pode substituir depois sem mudar telas |
| Canvas e grafos | React Flow (`@xyflow/react`) com arestas ortogonais (`smoothstep`) | Studio, linhagem, domínios e ecossistema |
| Gráficos | Apache ECharts | Tema escuro com séries verde/roxo |
| Estado | Zustand com persistência local | Estado da demo sobrevive a recarregar e tem "Restaurar demo" |
| Modo demonstração | Store Zustand sobre o `WorkspaceData` de `packages/schemas`, persistido no navegador | **Desvio:** sem MSW. O contrato comum é o modelo de dados; o cliente HTTP do modo conectado ainda precisa ser escrito atrás do mesmo store |
| MCP | `@modelcontextprotocol/sdk`, HTTP | Lê `packages/seed`, igual à aplicação |
| Backend conectado (`apps/api`) | Fora desta entrega | Onda futura (NestJS + PostgreSQL + pgvector) |

## 3. Ondas, entregas e status

Legenda: ✅ entregue nesta etapa · 🟡 parcial (simulado na demo) · ⏳ próxima etapa

### Onda 0 — Fundação (M)
| Entrega | Status |
|---|---|
| Tokens e design system (cores, Poppins, JetBrains Mono, halos, chips, selos de ambiente) | ✅ |
| Casca: menu em 5 grupos, seletor de workspace, seletor de ambiente com faixa de 3 px, "Ver como", busca Ctrl/⌘+K, botão Tour, migalhas | ✅ |
| Modelo de dados em `packages/schemas` | ✅ |
| Gerador dos 4 workspaces (Rede Sanare, Aurora Varejo, Banco Lumen, Onda Telecom) | ✅ |
| Camada de mock com contrato de API | ✅ |
| Motor do tour básico | ✅ |
| MCP e plugin mínimos | ✅ servidor e plugin · ⏳ prova com Claude Code construindo uma jornada (exige sessão com licença do usuário) |

**Gate:** navegar pelos 13 módulos com dados das 4 indústrias.

### Onda 1 — Conectar e organizar (G)
| Entrega | Status |
|---|---|
| Galeria de conectores (catálogo da seção 4), Meus conectores, detalhe | ✅ |
| Wizard de 5 passos com teste de conexão (4 checagens) e descoberta com PII mascarada | ✅ |
| Importar OpenAPI (JSON colado ou URL) gerando conector e tools | ✅ real no navegador |
| Conector PostgreSQL real | ⏳ depende do backend (`apps/api`) |
| Domínios de dados em canvas, contratos com 3 visões (Visual, Regras, Código ODCS), versionamento e bloqueio de quebra | ✅ |
| Lakehouse Bronze/Prata/Ouro, explorador de tabelas e SQL com resultados mockados | ✅ |
| Linhagem e base de conhecimento (coleções, teste de recuperação) | ✅ |

**Gate:** capítulos 1, 2 e 3 com piloto automático.

### Onda 2 — Cérebro e catálogo (M)
| Entrega | Status |
|---|---|
| Mapa do cérebro (negócio em roxo, técnico em verde, brilho por cobertura) e faixa de governança | ✅ |
| Visão de negócio com tabela de decisão testável e publicável como Rule | ✅ |
| Padrões técnicos e radar de tecnologia | ✅ |
| Catálogo (7 tipos), detalhe, ciclo de homologação | ✅ |

**Gate:** capítulo 4.

### Onda 3 — Studio (G)
| Entrega | Status |
|---|---|
| Paleta, canvas, inspetor, painel inferior (Testar, Problemas, Versões, Execuções) | ✅ |
| 8 categorias de nó, validação enquanto desenha com correção em um clique ("Inserir filtro de PII") | ✅ |
| Simulação passo a passo com trace (entrada, saída, regra, fonte, tokens, latência, custo) | ✅ |
| Casos de teste, versões, ver como código (JSON) | ✅ |
| "Descrever jornada" via `/cortex:desenhar` | 🟡 na demo usa modelo da indústria; real via Claude Code |

**Gate:** as 12 jornadas-âncora abrem e simulam.

### Onda 4 — Entregar (G)
| Entrega | Status |
|---|---|
| Ambientes & releases com promoção e gates em sequência, rollback | ✅ |
| Canais com simulador de celular (WhatsApp) disparando a jornada com trace ao lado | ✅ |
| Tela de conexão da IDE com configuração gerada | ✅ |
| Servidor MCP com recursos, ferramentas de leitura e escrita e prompts | ✅ |
| Plugin `cortex` com comandos `/cortex:*`, subagentes e hook | ✅ esqueleto |
| Ordem de construção (OC) e Studio acendendo nó a nó pelo progresso | 🟡 simulado na demo |

**Gate:** capítulo 6, com o Claude Code construindo uma jornada de verdade (⏳ ensaio manual).

### Onda 5 — Governar e medir (G)
| Entrega | Status |
|---|---|
| Iniciativas em kanban de 5 estágios e relatório de validação com 8 checagens | ✅ |
| Governança: políticas, editor visual, aprovações, auditoria | ✅ |
| Telemetria (5 visões), explorador de traces, sugestões do cérebro | ✅ |
| Cockpit executivo com "antes / com o Córtex" | ✅ |

**Gate:** capítulos 5 e 7.

### Onda 6 — Jornada guiada e polimento (M)
| Entrega | Status |
|---|---|
| 9 capítulos, 4 roteiros (Completo, Executivo, Técnico, por indústria) | ✅ |
| Narrador, destaque, avanço por teclado, pontos de restauração, "Restaurar demo" | ✅ |
| Modo apresentação com barra de capítulos | ✅ |
| Notas do apresentador em segunda janela (`/notas`) | ✅ |
| Piloto automático em todos os passos | ✅ verificado do capítulo 2 ao 8 no workspace de telecom |
| Revisão de acessibilidade, curadoria por indústria e ensaio | ⏳ humano |

## 4. Sequência de execução usada

1. Fundação feita em série: monorepo, esquemas, tokens, casca e store.
2. Em paralelo, sobre os esquemas: seed, motores (jornada, políticas, gates), servidor MCP + plugin, roteiros do tour.
3. Em paralelo, sobre seed e casca: um bloco por grupo de módulos (Visão, Cérebro, Studio, Ambientes/Canais/IDEs, Conectores, Dados/Conhecimento, Governança/Telemetria).
4. Integração, build estático, teste de fumaça no navegador e push para `pre-prod`.

## 5. Verificação feita nesta entrega

- `next build` limpo: 18 rotas estáticas; checagem de tipos sem erros.
- Testes do motor (`packages/engine/scripts/test.ts`): 16 passando. Checagem do seed (`packages/seed/scripts/check.ts`): integridade, determinismo e padrões da demo.
- Teste de fumaça do servidor MCP (`apps/mcp-server/scripts/smoke.ts`) contra o seed real.
- Navegador (telecom): os 14 módulos abrem sem erro de console; fluxo manual Testar → guardrail de PII → corrigir → Dev→Hml → Prd bloqueado → aprovação do dono → Prd; jornada guiada com piloto automático do capítulo 2 ao 8 sem intervenção.
- Não verificado: os outros 3 workspaces pela jornada guiada completa, e o Claude Code construindo uma OC de verdade (exige a licença do usuário).

## 6. Próximas etapas

1. `apps/api` (NestJS + PostgreSQL + pgvector) implementando o mesmo contrato do modo demonstração; conector PostgreSQL real.
2. Ensaio da prova de viabilidade (seção 9): instalar o plugin, conectar o MCP e rodar `/cortex:construir` sobre a jornada-âncora de telecom. Hoje o MCP guarda estado próprio; a OC criada na web não aparece nele até existir o backend.
3. Rodar a jornada guiada completa nos workspaces de saúde, varejo e financeiro.
4. Curadoria por indústria e checagem de nomes fictícios contra marcas existentes.
5. Publicação: Render (site estático, `render.yaml`) já configurado; MCP em um serviço Node separado.

## 7. Riscos acompanhados

Os mesmos da seção 17 do documento-fonte. Mitigação já aplicada nesta etapa: demo 100% offline com estado restaurável e roteiros em configuração.
