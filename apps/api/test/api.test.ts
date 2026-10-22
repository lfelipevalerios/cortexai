import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import type { NodeFile, NodeVersion, TreeNode, Workspace, WorkspaceTree } from '@cortex/schemas';
import { createDb, migrate, type Db } from '../src/db.ts';
import { createStorage } from '../src/storage.ts';
import { Repo } from '../src/repo.ts';
import { buildApp } from '../src/app.ts';

let app: FastifyInstance;
let db: Db;
let dir: string;

before(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'cortex-'));
  process.env.LOCAL_FILES_DIR = dir;
  delete process.env.SUPABASE_URL;
  process.env.PGLITE_DIR = 'memory://';
  db = await createDb('');
  await migrate(db);
  app = await buildApp(new Repo(db, await createStorage()));
});

after(async () => {
  await app.close();
  await db.close();
  await rm(dir, { recursive: true, force: true });
});

const as = (author: string) => ({ 'x-cortex-author': encodeURIComponent(author) });

async function call<T>(method: string, url: string, body?: unknown, author = 'Ana'): Promise<{ status: number; json: T }> {
  const res = await app.inject({ method: method as never, url, payload: body as never, headers: as(author) });
  return { status: res.statusCode, json: (res.body ? JSON.parse(res.body) : undefined) as T };
}

function upload(nodeId: string, name: string, content: string, author = 'Ana') {
  const boundary = '----cortex';
  const payload =
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: text/plain\r\n\r\n${content}\r\n--${boundary}--\r\n`;
  return app.inject({ method: 'POST', url: `/nodes/${nodeId}/files`, payload, headers: { ...as(author), 'content-type': `multipart/form-data; boundary=${boundary}` } });
}

let ws: Workspace;
let tree: WorkspaceTree;
let journey: TreeNode;

test('workspace nasce com o núcleo', async () => {
  const r = await call<Workspace>('POST', '/workspaces', { name: 'Onda Telecom', segment: 'Telecom' });
  assert.equal(r.status, 201);
  ws = r.json;
  tree = (await call<WorkspaceTree>('GET', `/workspaces/${ws.id}/tree`)).json;
  assert.equal(tree.core.kind, 'core');
  assert.equal(tree.core.name, 'Dados mestre');
  assert.equal(tree.core.children.length, 0);
});

test('frente fica no núcleo; jornada nasce com desenho e 5 capacidades', async () => {
  const front = await call<{ id: string }>('POST', '/nodes', { parentId: tree.core.id, kind: 'front', name: 'Atendimento PME' });
  assert.equal(front.status, 201);
  const bad = await call('POST', '/nodes', { parentId: tree.core.id, kind: 'journey', name: 'Fora do lugar' });
  assert.equal(bad.status, 400);
  const j = await call<{ id: string }>('POST', '/nodes', { parentId: front.json.id, kind: 'journey', name: 'Segunda via' });
  assert.equal(j.status, 201);
  tree = (await call<WorkspaceTree>('GET', `/workspaces/${ws.id}/tree`)).json;
  journey = tree.core.children[0].children[0];
  assert.deepEqual(
    journey.children.map((c) => c.capability ?? c.kind),
    ['design', 'arquitetura', 'engenharia', 'seguranca', 'dados', 'design_system'],
  );
  const listed = (await call<Workspace[]>('GET', '/workspaces')).json[0];
  assert.equal(listed.frontCount, 1);
  assert.equal(listed.journeyCount, 1);
});

test('gravações seguidas da mesma pessoa caem na mesma versão', async () => {
  const sec = journey.children.find((c) => c.capability === 'seguranca')!;
  const v1 = await call<NodeVersion>('PATCH', `/nodes/${sec.id}`, { body: 'Mascarar CPF' });
  assert.equal(v1.json.version, 2);
  const v2 = await call<NodeVersion>('PATCH', `/nodes/${sec.id}`, { body: 'Mascarar CPF e e-mail' });
  assert.equal(v2.json.version, 2, 'mesma autora em sequência: agrupa');
  const v3 = await call<NodeVersion>('PATCH', `/nodes/${sec.id}`, { body: 'Mascarar CPF, e-mail e telefone' }, 'Bruno');
  assert.equal(v3.json.version, 3, 'outra pessoa: nova versão');
  assert.equal(v3.json.createdBy, 'Bruno');
  const v4 = await call<NodeVersion>('PATCH', `/nodes/${sec.id}`, { body: 'Versão aprovada', note: 'Aprovado pela segurança' }, 'Bruno');
  assert.equal(v4.json.version, 4, 'com nota: sempre nova versão');
  const same = await call<NodeVersion>('PATCH', `/nodes/${sec.id}`, { body: 'Versão aprovada' }, 'Bruno');
  assert.equal(same.json.version, 4, 'sem mudança: não cria versão');

  const list = (await call<NodeVersion[]>('GET', `/nodes/${sec.id}/versions`)).json;
  assert.deepEqual(list.map((v) => v.version), [4, 3, 2, 1]);
  assert.equal(list.find((v) => v.version === 2)!.body, 'Mascarar CPF e e-mail');

  const restored = await call<NodeVersion>('POST', `/nodes/${sec.id}/versions/2/restore`);
  assert.equal(restored.json.version, 5);
  assert.equal(restored.json.body, 'Mascarar CPF e e-mail');
  assert.match(restored.json.note, /Restaurada da versão 2/);
});

test('só frentes e jornadas são renomeadas', async () => {
  const r = await call<NodeVersion>('PATCH', `/nodes/${tree.core.id}`, { name: 'Outro nome', body: 'Operadora regional' });
  assert.equal(r.json.name, 'Dados mestre');
  assert.equal(r.json.body, 'Operadora regional');
  const j = await call<NodeVersion>('PATCH', `/nodes/${journey.id}`, { name: 'Segunda via de fatura' });
  assert.equal(j.json.name, 'Segunda via de fatura');
});

test('arquivos: mesmo nome vira nova versão, conteúdo igual não duplica', async () => {
  const design = journey.children.find((c) => c.kind === 'design')!;
  const a = JSON.parse((await upload(design.id, 'fluxo.txt', 'versão A')).body) as NodeFile;
  assert.equal(a.current.version, 1);
  const b = JSON.parse((await upload(design.id, 'fluxo.txt', 'versão B', 'Bruno')).body) as NodeFile;
  assert.equal(b.id, a.id);
  assert.equal(b.current.version, 2);
  const again = JSON.parse((await upload(design.id, 'FLUXO.txt', 'versão B')).body) as NodeFile;
  assert.equal(again.current.version, 2);

  const files = (await call<NodeFile[]>('GET', `/nodes/${design.id}/files`)).json;
  assert.equal(files.length, 1);
  assert.equal(files[0].versionCount, 2);

  const v1 = await app.inject({ method: 'GET', url: `/files/${a.id}/download?version=1` });
  assert.equal(v1.body, 'versão A');
  const latest = await app.inject({ method: 'GET', url: `/files/${a.id}/download` });
  assert.equal(latest.body, 'versão B');
  assert.match(String(latest.headers['content-disposition']), /fluxo\.txt/);

  const t = (await call<WorkspaceTree>('GET', `/workspaces/${ws.id}/tree`)).json;
  assert.equal(t.core.children[0].children[0].children.find((c) => c.kind === 'design')!.fileCount, 1);

  assert.equal((await call('DELETE', `/files/${a.id}`)).status, 204);
  assert.equal((await call<NodeFile[]>('GET', `/nodes/${design.id}/files`)).json.length, 0);
  // O histórico continua baixável.
  assert.equal((await app.inject({ method: 'GET', url: `/files/${a.id}/download?version=1` })).body, 'versão A');
});

test('excluir uma frente esconde a subárvore sem apagar o histórico', async () => {
  const frontId = tree.core.children[0].id;
  assert.equal((await call('DELETE', `/nodes/${tree.core.id}`)).status, 400);
  assert.equal((await call('DELETE', `/nodes/${frontId}`)).status, 204);
  const t = (await call<WorkspaceTree>('GET', `/workspaces/${ws.id}/tree`)).json;
  assert.equal(t.core.children.length, 0);
  const [{ n }] = await db.query<{ n: number }>(`select count(*)::int as n from node_versions`);
  assert.ok(n > 8, 'versões preservadas no banco');
});

test('validação de entrada', async () => {
  assert.equal((await call('POST', '/workspaces', { name: '' })).status, 400);
  assert.equal((await call('GET', '/workspaces/nao-e-uuid/tree')).status, 400);
  assert.equal((await call('GET', '/workspaces/00000000-0000-0000-0000-000000000000/tree')).status, 404);
});
