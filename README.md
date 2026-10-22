# Córtex

O cérebro da empresa, organizado em árvore:

- **Workspace**: uma empresa, com o seu cérebro.
- **Núcleo**: dados mestre e informações globais do negócio.
- **Frentes de negócio**: em volta do núcleo.
- **Jornadas**: dentro de cada frente.
- **Desenho da jornada** e **capacidades técnicas** (Arquitetura, Engenharia de software, Segurança, Dados, Design System): dentro de cada jornada.

Todo item da árvore guarda texto livre e arquivos.

## Rodar

```bash
pnpm install
pnpm dev
```

Abre em http://localhost:3000.

## Estrutura

- `apps/web`: aplicação Next.js (export estático).
- `packages/schemas`: modelo da árvore.
- `packages/seed`: exemplos leves dos 4 workspaces.
- `packages/ui`: tokens de design.

## Onde ficam os dados

Ainda não há backend. O texto fica no `localStorage` e os arquivos no IndexedDB do navegador, então cada navegador tem a sua cópia.

## Deploy

`render.yaml` publica a branch `pre-prod` como site estático no Render.
