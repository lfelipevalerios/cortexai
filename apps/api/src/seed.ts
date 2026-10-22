// Uso: pnpm --filter @cortex/api seed (não faz nada se já houver workspaces).
import { createDb, migrate } from './db.ts';
import { createStorage } from './storage.ts';
import { Repo } from './repo.ts';
import { seedIfEmpty } from './seed-data.ts';

const db = await createDb();
await migrate(db);
const created = await seedIfEmpty(new Repo(db, await createStorage()));
console.log(created ? `Criados ${created} workspaces de exemplo.` : 'Já existem workspaces; nada a fazer.');
await db.close();
