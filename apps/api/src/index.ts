import { createDb, migrate } from './db.ts';
import { createStorage } from './storage.ts';
import { Repo } from './repo.ts';
import { buildApp } from './app.ts';
import { seedIfEmpty } from './seed-data.ts';

const db = await createDb();
const applied = await migrate(db);
const storage = await createStorage();
const repo = new Repo(db, storage);
// SEED_ON_START=1 cria os workspaces de exemplo quando o banco está vazio.
const seeded = process.env.SEED_ON_START === '1' ? await seedIfEmpty(repo) : 0;
const app = await buildApp(repo, { corsOrigin: process.env.CORS_ORIGIN, logger: true });

app.log.info({ db: db.kind, storage: storage.kind, migrations: applied, seeded }, 'Córtex API pronta');
await app.listen({ port: Number(process.env.PORT ?? 4000), host: process.env.HOST ?? '0.0.0.0' });

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, async () => {
    await app.close();
    await db.close();
    process.exit(0);
  });
}
