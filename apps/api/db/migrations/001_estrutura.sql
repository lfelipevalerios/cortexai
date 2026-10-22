-- Estrutura do cérebro: workspaces, árvore de nós e versões.
-- Nada é apagado fisicamente: exclusões preenchem deleted_at e o histórico continua consultável.

create table workspaces (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  segment     text not null default '',
  tagline     text not null default '',
  created_at  timestamptz not null default now(),
  created_by  text not null default '',
  deleted_at  timestamptz
);

-- Árvore: core (1 por workspace) → front → journey → design | capability.
create table nodes (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id),
  parent_id     uuid references nodes(id),
  kind          text not null check (kind in ('core', 'front', 'journey', 'design', 'capability')),
  capability    text check (capability in ('arquitetura', 'engenharia', 'seguranca', 'dados', 'design_system')),
  position      integer not null default 0,
  created_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  check ((kind = 'capability') = (capability is not null)),
  check ((kind = 'core') = (parent_id is null))
);
create index nodes_workspace on nodes (workspace_id) where deleted_at is null;
create index nodes_parent on nodes (parent_id);
create unique index nodes_one_core on nodes (workspace_id) where kind = 'core';

-- Cada alteração de nome, resumo ou texto gera uma versão.
create table node_versions (
  node_id     uuid not null references nodes(id),
  version     integer not null,
  name        text not null,
  summary     text not null default '',
  body        text not null default '',
  note        text not null default '',
  created_at  timestamptz not null default now(),
  created_by  text not null default '',
  -- Última gravação automática que caiu nesta versão (ver regra de agrupamento na API).
  updated_at  timestamptz not null default now(),
  primary key (node_id, version)
);

-- Arquivo lógico de um nó; o conteúdo fica no storage, por versão.
create table files (
  id          uuid primary key default gen_random_uuid(),
  node_id     uuid not null references nodes(id),
  name        text not null,
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index files_node on files (node_id) where deleted_at is null;
-- Enviar de novo um arquivo com o mesmo nome no mesmo nó cria uma nova versão dele.
create unique index files_node_name on files (node_id, lower(name)) where deleted_at is null;

create table file_versions (
  file_id       uuid not null references files(id),
  version       integer not null,
  storage_path  text not null,
  size          bigint not null,
  mime          text not null,
  sha256        text not null,
  created_at    timestamptz not null default now(),
  created_by    text not null default '',
  primary key (file_id, version)
);
