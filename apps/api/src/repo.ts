import { createHash, randomUUID } from 'node:crypto';
import {
  CAPABILITIES, CAPABILITY_IDS,
  type CapabilityId, type CreateNodeInput, type CreateWorkspaceInput, type FileVersion, type NodeFile,
  type NodeKind, type NodeVersion, type TreeNode, type UpdateNodeInput, type Workspace, type WorkspaceTree,
} from '@cortex/schemas';
import type { Db, Sql } from './db.ts';
import type { Storage } from './storage.ts';

export class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * Gravações seguidas da mesma pessoa no mesmo nó, em até 5 minutos e sem nota,
 * caem na mesma versão (o texto é salvo enquanto se digita). Qualquer outra
 * gravação abre uma versão nova.
 */
export const COALESCE_MINUTES = 5;

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : new Date(String(v)).toISOString());

const FIXED_NAMES: Record<Exclude<NodeKind, 'front' | 'journey' | 'capability'>, string> = {
  core: 'Dados mestre',
  design: 'Desenho da jornada',
};

const capabilityLabel = (id: CapabilityId) => CAPABILITIES.find((c) => c.id === id)!.label;

interface NodeRow {
  id: string;
  workspace_id: string;
  parent_id: string | null;
  kind: NodeKind;
  capability: CapabilityId | null;
  position: number;
  version: number;
  name: string;
  summary: string;
  body: string;
  updated_at: Date;
  updated_by: string;
  file_count: number;
}

export class Repo {
  readonly db: Db;
  readonly storage: Storage;
  constructor(db: Db, storage: Storage) {
    this.db = db;
    this.storage = storage;
  }

  // ---------- Workspaces ----------

  async listWorkspaces(): Promise<Workspace[]> {
    const rows = await this.db.query<Record<string, unknown>>(
      `select w.*,
         (select count(*)::int from nodes n where n.workspace_id = w.id and n.kind = 'front' and n.deleted_at is null) as front_count,
         (select count(*)::int from nodes n where n.workspace_id = w.id and n.kind = 'journey' and n.deleted_at is null) as journey_count
       from workspaces w where w.deleted_at is null order by w.created_at`,
    );
    return rows.map(mapWorkspace);
  }

  async getWorkspace(id: string): Promise<Workspace> {
    const all = await this.listWorkspaces();
    const ws = all.find((w) => w.id === id);
    if (!ws) throw new HttpError(404, 'Workspace não encontrado');
    return ws;
  }

  async createWorkspace(input: CreateWorkspaceInput, author: string): Promise<Workspace> {
    const id = await this.db.tx(async (t) => {
      const [ws] = await t.query<{ id: string }>(
        `insert into workspaces (name, segment, tagline, created_by) values ($1, $2, $3, $4) returning id`,
        [input.name, input.segment ?? '', input.tagline ?? '', author],
      );
      await insertNode(t, { workspaceId: ws.id, parentId: null, kind: 'core', name: FIXED_NAMES.core, author });
      return ws.id;
    });
    return this.getWorkspace(id);
  }

  async updateWorkspace(id: string, input: Partial<CreateWorkspaceInput>): Promise<Workspace> {
    await this.getWorkspace(id);
    await this.db.query(
      `update workspaces set name = coalesce($2, name), segment = coalesce($3, segment), tagline = coalesce($4, tagline) where id = $1`,
      [id, input.name ?? null, input.segment ?? null, input.tagline ?? null],
    );
    return this.getWorkspace(id);
  }

  async deleteWorkspace(id: string): Promise<void> {
    await this.getWorkspace(id);
    await this.db.query(`update workspaces set deleted_at = now() where id = $1`, [id]);
  }

  // ---------- Árvore ----------

  async getTree(workspaceId: string): Promise<WorkspaceTree> {
    const workspace = await this.getWorkspace(workspaceId);
    const rows = await this.db.query<NodeRow>(
      `select n.id, n.workspace_id, n.parent_id, n.kind, n.capability, n.position,
              v.version, v.name, v.summary, v.body, v.updated_at, v.created_by as updated_by,
              (select count(*)::int from files f where f.node_id = n.id and f.deleted_at is null) as file_count
         from nodes n
         join lateral (select * from node_versions nv where nv.node_id = n.id order by nv.version desc limit 1) v on true
        where n.workspace_id = $1 and n.deleted_at is null`,
      [workspaceId],
    );
    const byId = new Map<string, TreeNode & { position: number }>();
    for (const r of rows) {
      byId.set(r.id, {
        id: r.id,
        kind: r.kind,
        capability: r.capability,
        parentId: r.parent_id,
        name: r.name,
        summary: r.summary,
        body: r.body,
        version: r.version,
        updatedAt: iso(r.updated_at),
        updatedBy: r.updated_by,
        fileCount: r.file_count,
        children: [],
        position: r.position,
      });
    }
    let core: TreeNode | undefined;
    for (const n of byId.values()) {
      if (n.kind === 'core') core = n;
      else byId.get(n.parentId!)?.children.push(n);
    }
    if (!core) throw new HttpError(500, 'Workspace sem núcleo');
    const order = (n: TreeNode & { position?: number }) =>
      n.kind === 'design' ? -1 : n.kind === 'capability' ? CAPABILITY_IDS.indexOf(n.capability!) : (n.position ?? 0);
    const sort = (n: TreeNode) => {
      n.children.sort((a, b) => order(a) - order(b));
      n.children.forEach(sort);
      delete (n as { position?: number }).position;
    };
    sort(core);
    return { workspace, core };
  }

  private async node(id: string, q: Sql = this.db) {
    const [n] = await q.query<{ id: string; workspace_id: string; kind: NodeKind; parent_id: string | null }>(
      `select n.id, n.workspace_id, n.kind, n.parent_id from nodes n
         join workspaces w on w.id = n.workspace_id
        where n.id = $1 and n.deleted_at is null and w.deleted_at is null`,
      [id],
    );
    if (!n) throw new HttpError(404, 'Item não encontrado');
    return n;
  }

  async createNode(input: CreateNodeInput, author: string): Promise<string> {
    return this.db.tx(async (t) => {
      const parent = await this.node(input.parentId, t);
      const expected = input.kind === 'front' ? 'core' : 'front';
      if (parent.kind !== expected) {
        throw new HttpError(400, input.kind === 'front' ? 'Frentes de negócio ficam no núcleo' : 'Jornadas ficam dentro de uma frente de negócio');
      }
      const id = await insertNode(t, { workspaceId: parent.workspace_id, parentId: parent.id, kind: input.kind, name: input.name, summary: input.summary, author });
      if (input.kind === 'journey') {
        await insertNode(t, { workspaceId: parent.workspace_id, parentId: id, kind: 'design', name: FIXED_NAMES.design, author });
        for (const cap of CAPABILITY_IDS) {
          await insertNode(t, { workspaceId: parent.workspace_id, parentId: id, kind: 'capability', capability: cap, name: capabilityLabel(cap), author });
        }
      }
      return id;
    });
  }

  /** Grava nome, resumo e texto. Devolve a versão resultante. */
  async updateNode(id: string, input: UpdateNodeInput, author: string): Promise<NodeVersion> {
    return this.db.tx(async (t) => {
      const node = await this.node(id, t);
      const [cur] = await t.query<Record<string, unknown>>(
        `select *, (updated_at > now() - make_interval(mins => $2)) as recent
           from node_versions where node_id = $1 order by version desc limit 1 for update`,
        [id, COALESCE_MINUTES],
      );
      // Só frentes e jornadas podem ser renomeadas.
      const renamable = node.kind === 'front' || node.kind === 'journey';
      const next = {
        name: renamable && input.name !== undefined ? input.name : (cur.name as string),
        summary: renamable && input.summary !== undefined ? input.summary : (cur.summary as string),
        body: input.body ?? (cur.body as string),
      };
      const note = input.note?.trim() ?? '';
      const unchanged = next.name === cur.name && next.summary === cur.summary && next.body === cur.body;
      if (unchanged && !note) return mapVersion(cur);

      const coalesce = !note && !cur.note && cur.recent === true && cur.created_by === author && Number(cur.version) > 1;
      if (coalesce) {
        const [row] = await t.query(
          `update node_versions set name = $3, summary = $4, body = $5, updated_at = now()
            where node_id = $1 and version = $2 returning *`,
          [id, cur.version, next.name, next.summary, next.body],
        );
        return mapVersion(row);
      }
      const [row] = await t.query(
        `insert into node_versions (node_id, version, name, summary, body, note, created_by)
         values ($1, $2, $3, $4, $5, $6, $7) returning *`,
        [id, Number(cur.version) + 1, next.name, next.summary, next.body, note, author],
      );
      return mapVersion(row);
    });
  }

  /** Exclusão lógica do nó e de tudo abaixo dele, com seus arquivos. */
  async deleteNode(id: string): Promise<void> {
    const node = await this.node(id);
    if (node.kind !== 'front' && node.kind !== 'journey') throw new HttpError(400, 'Só frentes e jornadas podem ser excluídas');
    await this.db.tx(async (t) => {
      const ids = (
        await t.query<{ id: string }>(
          `with recursive sub as (select id from nodes where id = $1 union all select n.id from nodes n join sub on n.parent_id = sub.id)
           select id from sub`,
          [id],
        )
      ).map((r) => r.id);
      await t.query(`update nodes set deleted_at = now() where id = any($1::uuid[]) and deleted_at is null`, [ids]);
      await t.query(`update files set deleted_at = now() where node_id = any($1::uuid[]) and deleted_at is null`, [ids]);
    });
  }

  async listVersions(id: string): Promise<NodeVersion[]> {
    await this.node(id);
    const rows = await this.db.query(`select * from node_versions where node_id = $1 order by version desc`, [id]);
    return rows.map(mapVersion);
  }

  async restoreVersion(id: string, version: number, author: string): Promise<NodeVersion> {
    return this.db.tx(async (t) => {
      await this.node(id, t);
      const [old] = await t.query<Record<string, unknown>>(`select * from node_versions where node_id = $1 and version = $2`, [id, version]);
      if (!old) throw new HttpError(404, 'Versão não encontrada');
      const [{ max }] = await t.query<{ max: number }>(`select max(version)::int as max from node_versions where node_id = $1`, [id]);
      const [row] = await t.query(
        `insert into node_versions (node_id, version, name, summary, body, note, created_by)
         values ($1, $2, $3, $4, $5, $6, $7) returning *`,
        [id, max + 1, old.name, old.summary, old.body, `Restaurada da versão ${version}`, author],
      );
      return mapVersion(row);
    });
  }

  // ---------- Arquivos ----------

  async listFiles(nodeId: string): Promise<NodeFile[]> {
    await this.node(nodeId);
    const rows = await this.db.query<Record<string, unknown>>(
      `select f.id, f.node_id, f.name, v.version, v.size::int as size, v.mime, v.sha256, v.created_at, v.created_by,
              (select count(*)::int from file_versions x where x.file_id = f.id) as version_count
         from files f
         join lateral (select * from file_versions fv where fv.file_id = f.id order by fv.version desc limit 1) v on true
        where f.node_id = $1 and f.deleted_at is null
        order by f.created_at`,
      [nodeId],
    );
    return rows.map((r) => ({
      id: r.id as string,
      nodeId: r.node_id as string,
      name: r.name as string,
      current: mapFileVersion(r),
      versionCount: r.version_count as number,
    }));
  }

  /** Envia um arquivo. Mesmo nome no mesmo nó vira nova versão; conteúdo idêntico não duplica. */
  async addFile(nodeId: string, name: string, data: Buffer, mime: string, author: string): Promise<NodeFile> {
    const node = await this.node(nodeId);
    const sha256 = createHash('sha256').update(data).digest('hex');
    const safe = name.replace(/[^\w.\-]+/g, '_').slice(-120) || 'arquivo';

    const plan = await this.db.tx(async (t) => {
      let [file] = await t.query<{ id: string }>(`select id from files where node_id = $1 and lower(name) = lower($2) and deleted_at is null for update`, [nodeId, name]);
      if (!file) [file] = await t.query<{ id: string }>(`insert into files (node_id, name) values ($1, $2) returning id`, [nodeId, name]);
      const [last] = await t.query<{ version: number; sha256: string }>(`select version, sha256 from file_versions where file_id = $1 order by version desc limit 1`, [file.id]);
      if (last && last.sha256 === sha256) return { fileId: file.id, skip: true as const };
      const version = (last?.version ?? 0) + 1;
      const key = `${node.workspace_id}/${nodeId}/${file.id}/v${version}-${randomUUID().slice(0, 8)}-${safe}`;
      // O conteúdo vai para o storage antes de a versão existir no banco.
      await this.storage.put(key, data, mime);
      await t.query(
        `insert into file_versions (file_id, version, storage_path, size, mime, sha256, created_by) values ($1, $2, $3, $4, $5, $6, $7)`,
        [file.id, version, key, data.length, mime, sha256, author],
      );
      return { fileId: file.id, skip: false as const };
    });
    const files = await this.listFiles(nodeId);
    return files.find((f) => f.id === plan.fileId)!;
  }

  async listFileVersions(fileId: string): Promise<FileVersion[]> {
    await this.file(fileId);
    const rows = await this.db.query(`select version, size::int as size, mime, sha256, created_at, created_by from file_versions where file_id = $1 order by version desc`, [fileId]);
    return rows.map(mapFileVersion);
  }

  async downloadFile(fileId: string, version?: number) {
    const file = await this.file(fileId, true);
    const [v] = await this.db.query<{ storage_path: string; mime: string; version: number }>(
      `select storage_path, mime, version from file_versions where file_id = $1 ${version ? 'and version = $2' : ''} order by version desc limit 1`,
      version ? [fileId, version] : [fileId],
    );
    if (!v) throw new HttpError(404, 'Versão do arquivo não encontrada');
    return { name: file.name, mime: v.mime, content: await this.storage.get(v.storage_path, file.name) };
  }

  async deleteFile(fileId: string): Promise<void> {
    await this.file(fileId);
    await this.db.query(`update files set deleted_at = now() where id = $1`, [fileId]);
  }

  /** Arquivo de um nó ativo. Downloads de versões antigas continuam valendo após a exclusão. */
  private async file(id: string, allowDeleted = false) {
    const [f] = await this.db.query<{ id: string; name: string }>(
      `select f.id, f.name from files f where f.id = $1 ${allowDeleted ? '' : 'and f.deleted_at is null'}`,
      [id],
    );
    if (!f) throw new HttpError(404, 'Arquivo não encontrado');
    return f;
  }
}

async function insertNode(t: Sql, n: {
  workspaceId: string; parentId: string | null; kind: NodeKind; capability?: CapabilityId; name: string; summary?: string; author: string;
}): Promise<string> {
  const [{ pos }] = await t.query<{ pos: number }>(
    `select coalesce(max(position), -1)::int + 1 as pos from nodes where workspace_id = $1 and parent_id is not distinct from $2`,
    [n.workspaceId, n.parentId],
  );
  const [row] = await t.query<{ id: string }>(
    `insert into nodes (workspace_id, parent_id, kind, capability, position) values ($1, $2, $3, $4, $5) returning id`,
    [n.workspaceId, n.parentId, n.kind, n.capability ?? null, pos],
  );
  await t.query(
    `insert into node_versions (node_id, version, name, summary, created_by, note) values ($1, 1, $2, $3, $4, 'Criado')`,
    [row.id, n.name, n.summary ?? '', n.author],
  );
  return row.id;
}

function mapWorkspace(r: Record<string, unknown>): Workspace {
  return {
    id: r.id as string,
    name: r.name as string,
    segment: r.segment as string,
    tagline: r.tagline as string,
    createdAt: iso(r.created_at),
    frontCount: Number(r.front_count ?? 0),
    journeyCount: Number(r.journey_count ?? 0),
  };
}

function mapVersion(r: Record<string, unknown>): NodeVersion {
  return {
    version: Number(r.version),
    name: r.name as string,
    summary: r.summary as string,
    body: r.body as string,
    note: r.note as string,
    createdAt: iso(r.updated_at ?? r.created_at),
    createdBy: r.created_by as string,
  };
}

function mapFileVersion(r: Record<string, unknown>): FileVersion {
  return {
    version: Number(r.version),
    size: Number(r.size),
    mime: r.mime as string,
    sha256: r.sha256 as string,
    createdAt: iso(r.created_at),
    createdBy: r.created_by as string,
  };
}
