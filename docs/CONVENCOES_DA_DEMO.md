# Convenções da demo (apps/web)

Regras compartilhadas entre as telas, a jornada guiada e os pontos de restauração. Todo estado de demonstração vive em `WorkspaceData` (store Zustand, `useWs()` / `mutate()`), exceto onde indicado como *flag*.

## Arquitetura da tela
- Página em `src/app/<rota>/page.tsx` (`'use client'`), componentes em `src/components/<modulo>/`.
- `useSearchParams` sempre dentro de `<Suspense>` (exigência do export estático).
- Arquivos compartilhados (não editar a partir de um módulo): `lib/store.ts`, `lib/tour-bus.ts`, `lib/modules.ts`, `components/ui/*`, `components/shell/*`, `app/layout.tsx`, `app/globals.css`.
- Mudanças de dados: `useCortex(s => s.mutate)(draft => {...}, { action, object })` registra auditoria. Ações destrutivas: toast com `undo` restaurando o workspace retornado por `mutate` via `replaceWorkspace`.
- Prefixo de ids por indústria: saude `sau`, varejo `var`, financeiro `fin`, telecom `tel`. `DEMO_IDS[industry]` (de `@cortex/seed`) traz os objetos-chave.

## Jornada guiada
- Alvos: `data-tour="<alvo>"` conforme `packages/tour/CONTRACT.md`.
- Ações: `useAutoAction(id, fn)` registra o piloto automático; a mesma ação feita à mão ou pelo piloto chama `emitTourAction(id)` uma vez ao concluir.

## Estado por capítulo
| Marco | Onde fica |
|---|---|
| CRM conectado pelo wizard | conector `<p>-cn-crm` em `connectors`; `systems[crmSystemId].connectorId = '<p>-cn-crm'`; componente `<p>-cp-mcp-crm` passa a `em_revisao` |
| Cockpit em "antes do Córtex" | *flag* `cockpit-antes` |
| Campo do contrato bloqueado | nada persiste (publicação bloqueada) |
| Regra publicada como componente | `decisionTables[showcase].componentId` aponta para um componente `rule` (`<p>-cp-rule-showcase`, status `homologado`) |
| Iniciativa-âncora | estágio `ideia` → `validacao` (validada) → `prototipo` (Seguir, `validation.decision='seguir'`) → `construcao` (Gerar jornada) |
| Filtro de PII inserido | nova `JourneyVersion` (minor) na jornada-âncora, `envVersions.dev` aponta para ela |
| Promoção Dev → Hml | `envVersions.hml = versão`; `releases` recebe `{status:'promovida'}` |
| Tentativa Hml → Prd | `approvals` recebe 2 pedidos `kind:'promocao'`, `objectId = '<journeyId>@<versão>->prd'`, `approverProfile` `dono_negocio` e `coe` (o do CoE já `aprovado` na demo); `releases` recebe `{status:'bloqueada'}` enquanto o dono não aprova |
| WhatsApp plugado | `channels[whatsapp].journeyByEnv.dev` e `.hml` = jornada-âncora, `status:'ativo'` |
| Mensagem no simulador | nova `Execution` no início de `executions` |
| Enviar para construção | `buildOrders` recebe OC `status:'na_fila'`; simulação marca `progress[nodeId]='construido'` e termina em `pronta_revisao` com `prUrl` e evidências |
| Sugestão aceita | `suggestions[i].status='aceita'` e novo componente `rascunho` no catálogo |
