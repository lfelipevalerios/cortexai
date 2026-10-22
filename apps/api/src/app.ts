import Fastify, { type FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { z } from 'zod';
import { AUTHOR_HEADER, MAX_FILE_BYTES } from '@cortex/schemas';
import { HttpError, type Repo } from './repo.ts';

const uuid = z.string().uuid();
const text = (max: number) => z.string().trim().max(max);

const schemas = {
  workspace: z.object({ name: text(120).min(1), segment: text(80).optional(), tagline: text(200).optional() }),
  workspacePatch: z.object({ name: text(120).min(1).optional(), segment: text(80).optional(), tagline: text(200).optional() }),
  node: z.object({ parentId: uuid, kind: z.enum(['front', 'journey']), name: text(120).min(1), summary: text(300).optional() }),
  nodePatch: z.object({ name: text(120).min(1).optional(), summary: text(300).optional(), body: z.string().max(200_000).optional(), note: text(300).optional() }),
};

function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const r = schema.safeParse(data);
  if (!r.success) throw new HttpError(400, r.error.issues.map((i) => `${i.path.join('.') || 'corpo'}: ${i.message}`).join('; '));
  return r.data;
}

/** Sem login por enquanto: a autoria vem do nome informado no navegador. */
function author(req: FastifyRequest): string {
  const raw = req.headers[AUTHOR_HEADER];
  const v = Array.isArray(raw) ? raw[0] : raw;
  return decodeURIComponent(v ?? '').trim().slice(0, 80) || 'Anônimo';
}

const id = (req: FastifyRequest, key = 'id') => parse(uuid, (req.params as Record<string, string>)[key]);

export async function buildApp(repo: Repo, opts: { corsOrigin?: string; logger?: boolean } = {}) {
  const app = Fastify({ logger: opts.logger ?? false, bodyLimit: 1024 * 1024 });

  const origins = (opts.corsOrigin ?? '*').split(',').map((s) => s.trim());
  await app.register(cors, { origin: origins.includes('*') ? true : origins, methods: ['GET', 'POST', 'PATCH', 'DELETE'], exposedHeaders: ['content-disposition'] });
  await app.register(multipart, { limits: { fileSize: MAX_FILE_BYTES, files: 1 } });

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof HttpError) return reply.status(err.status).send({ error: err.message });
    const e = err as { statusCode?: number; code?: string; message: string };
    if (e.code === 'FST_REQ_FILE_TOO_LARGE') return reply.status(413).send({ error: 'Arquivo maior que 25 MB' });
    if (e.statusCode && e.statusCode < 500) return reply.status(e.statusCode).send({ error: e.message });
    app.log.error(err);
    return reply.status(500).send({ error: 'Erro interno' });
  });

  app.get('/health', async () => ({ ok: true, db: repo.db.kind, storage: repo.storage.kind }));

  // Workspaces
  app.get('/workspaces', () => repo.listWorkspaces());
  app.post('/workspaces', async (req, reply) => reply.status(201).send(await repo.createWorkspace(parse(schemas.workspace, req.body), author(req))));
  app.patch('/workspaces/:id', (req) => repo.updateWorkspace(id(req), parse(schemas.workspacePatch, req.body)));
  app.delete('/workspaces/:id', async (req, reply) => {
    await repo.deleteWorkspace(id(req));
    return reply.status(204).send();
  });
  app.get('/workspaces/:id/tree', (req) => repo.getTree(id(req)));

  // Nós da árvore
  app.post('/nodes', async (req, reply) => reply.status(201).send({ id: await repo.createNode(parse(schemas.node, req.body), author(req)) }));
  app.patch('/nodes/:id', (req) => repo.updateNode(id(req), parse(schemas.nodePatch, req.body), author(req)));
  app.delete('/nodes/:id', async (req, reply) => {
    await repo.deleteNode(id(req));
    return reply.status(204).send();
  });
  app.get('/nodes/:id/versions', (req) => repo.listVersions(id(req)));
  app.post('/nodes/:id/versions/:version/restore', (req) => {
    const v = parse(z.coerce.number().int().positive(), (req.params as Record<string, string>).version);
    return repo.restoreVersion(id(req), v, author(req));
  });

  // Arquivos
  app.get('/nodes/:id/files', (req) => repo.listFiles(id(req)));
  app.post('/nodes/:id/files', async (req, reply) => {
    const part = await req.file();
    if (!part) throw new HttpError(400, 'Envie um arquivo no campo "file"');
    const data = await part.toBuffer();
    return reply.status(201).send(await repo.addFile(id(req), part.filename, data, part.mimetype || 'application/octet-stream', author(req)));
  });
  app.get('/files/:id/versions', (req) => repo.listFileVersions(id(req)));
  app.get('/files/:id/download', async (req, reply) => {
    const q = req.query as Record<string, string | undefined>;
    const version = q.version ? parse(z.coerce.number().int().positive(), q.version) : undefined;
    const f = await repo.downloadFile(id(req), version);
    if ('url' in f.content) return reply.redirect(f.content.url);
    const disposition = q.inline === '1' ? 'inline' : 'attachment';
    return reply
      .header('content-type', f.mime)
      .header('content-disposition', `${disposition}; filename*=UTF-8''${encodeURIComponent(f.name)}`)
      .send(f.content.data);
  });
  app.delete('/files/:id', async (req, reply) => {
    await repo.deleteFile(id(req));
    return reply.status(204).send();
  });

  return app;
}
