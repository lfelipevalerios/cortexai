# Córtex

O cérebro da empresa, organizado em árvore:

- **Workspace**: uma empresa, com o seu cérebro.
- **Núcleo**: dados mestre e informações globais do negócio.
- **Frentes de negócio**: em volta do núcleo.
- **Jornadas**: dentro de cada frente.
- **Desenho da jornada** e **capacidades técnicas** (Arquitetura, Engenharia de software, Segurança, Dados, Design System): dentro de cada jornada.

Todo item da árvore guarda texto e arquivos, os dois com histórico de versões.

## Arquitetura

| Parte | Tecnologia | Onde roda |
|---|---|---|
| `apps/web` | Next.js (export estático) + React Query | Render, site estático |
| `apps/api` | Node 22 + Fastify | Render, web service |
| Banco | Postgres | Supabase |
| Arquivos | Supabase Storage, bucket privado `cortex-files` | Supabase |
| `packages/schemas` | Tipos do contrato entre web e API | — |

Ainda não há login: cada pessoa informa o próprio nome no navegador e ele assina as versões que ela grava.

## Modelo de dados versionado

Migrações em `apps/api/db/migrations`, aplicadas automaticamente quando a API sobe.

- `workspaces`
- `nodes`: a árvore (`core`, `front`, `journey`, `design`, `capability`). Criar uma jornada já cria o desenho e as 5 capacidades.
- `node_versions`: cada alteração de nome, resumo ou texto vira uma versão, com autor e nota.
- `files` e `file_versions`: enviar de novo um arquivo com o mesmo nome no mesmo item cria uma nova versão; conteúdo idêntico não duplica. O binário fica no Storage.

Regras:

- **Agrupamento**: gravações seguidas da mesma pessoa no mesmo item, em até 5 minutos e sem nota, entram na mesma versão, porque o texto é salvo enquanto se digita. "Salvar versão" com nota sempre abre uma versão nova.
- **Restaurar**: cria uma versão nova com o conteúdo antigo; nada é sobrescrito.
- **Excluir**: é lógico (`deleted_at`). O item sai do cérebro, mas versões e arquivos continuam no banco.

## API

| Método e rota | O que faz |
|---|---|
| `GET /workspaces` · `POST /workspaces` | Lista e cria workspaces |
| `GET /workspaces/:id/tree` | Árvore inteira com a versão atual de cada item |
| `POST /nodes` | Cria frente (no núcleo) ou jornada (numa frente) |
| `PATCH /nodes/:id` | Grava nome, resumo, texto e nota |
| `DELETE /nodes/:id` | Exclui frente ou jornada |
| `GET /nodes/:id/versions` · `POST /nodes/:id/versions/:v/restore` | Histórico e restauração |
| `GET /nodes/:id/files` · `POST /nodes/:id/files` | Lista e envia arquivos (multipart, campo `file`, até 25 MB) |
| `GET /files/:id/versions` · `GET /files/:id/download?version=` | Versões e download |
| `DELETE /files/:id` | Remove o arquivo do item (as versões continuam baixáveis) |

O nome de quem edita vai no cabeçalho `x-cortex-author`.

## Rodar localmente

Sem variáveis de ambiente, a API usa um Postgres embutido (PGlite) e grava arquivos em `apps/api/.data`.

```bash
pnpm install
pnpm --filter @cortex/api seed
pnpm --filter @cortex/api dev
pnpm dev
```

A API sobe em http://localhost:4000 e o site em http://localhost:3000. Testes da API:

```bash
pnpm --filter @cortex/api test
```

## Configurar Supabase e Render

1. No Supabase, crie um projeto.
2. No Supabase, copie em **Connect** a URL do **Session pooler** (o Render não alcança a conexão direta, que é só IPv6).
3. No Supabase, copie em **Project Settings → API Keys** a chave `service_role`.
4. No Render, use **New → Blueprint** apontando para este repositório. O `render.yaml` cria `cortex-api` e `cortex-web`.
5. No `cortex-api`, preencha:
   - `DATABASE_URL`: a URL do pooler.
   - `SUPABASE_URL`: `https://<projeto>.supabase.co`.
   - `SUPABASE_SERVICE_ROLE_KEY`: a chave `service_role`.
   - `CORS_ORIGIN`: o endereço do site.
6. No `cortex-web`, preencha `NEXT_PUBLIC_API_URL` com o endereço da API e faça um novo deploy do site.

A API cria as tabelas e o bucket sozinha na primeira subida. Com `SEED_ON_START=1`, ela também cria os workspaces de exemplo se o banco estiver vazio.

Atenção: sem login, qualquer pessoa com o endereço do site pode ler e editar o conteúdo.
