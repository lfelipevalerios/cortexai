import { readdir, readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Banco: Postgres do Supabase quando DATABASE_URL existe; senão um Postgres
// embutido (PGlite) para desenvolvimento e testes locais.

export interface Sql {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
}

export interface Db extends Sql {
  tx<T>(fn: (q: Sql) => Promise<T>): Promise<T>;
  close(): Promise<void>;
  kind: 'postgres' | 'pglite';
}

export async function createDb(url = process.env.DATABASE_URL): Promise<Db> {
  if (url) {
    const { default: postgres } = await import('postgres');
    // prepare: false é exigido pelo pooler do Supabase em modo transação.
    const sql = postgres(url, { prepare: false, max: 5, onnotice: () => undefined });
    type Unsafe = { unsafe: (text: string, params?: never[]) => Promise<unknown> };
    const wrap = (s: Unsafe): Sql => ({
      query: async <T>(text: string, params: unknown[] = []) => (await s.unsafe(text, params as never[])) as T[],
    });
    return {
      kind: 'postgres',
      ...wrap(sql as unknown as Unsafe),
      tx: (fn) => sql.begin((t) => fn(wrap(t as unknown as Unsafe))) as never,
      close: () => sql.end(),
    };
  }

  const { PGlite } = await import('@electric-sql/pglite');
  const dir = process.env.PGLITE_DIR ?? '.data/pg';
  if (dir !== 'memory://') await mkdir(dir, { recursive: true });
  const pg = new PGlite(dir === 'memory://' ? undefined : dir);
  await pg.waitReady;
  const q = (s: { query: typeof pg.query }): Sql => ({
    query: async <T>(text: string, params: unknown[] = []) => (await s.query<T>(text, params)).rows,
  });
  return {
    kind: 'pglite',
    ...q(pg),
    tx: (fn) => pg.transaction((t) => fn(q(t as never))),
    close: () => pg.close(),
  };
}

const MIGRATIONS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'db', 'migrations');

/** Aplica as migrações pendentes, em ordem, cada uma numa transação. */
export async function migrate(db: Db): Promise<string[]> {
  await db.query(`create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())`);
  const files = (await readdir(MIGRATIONS)).filter((f) => f.endsWith('.sql')).sort();
  const applied: string[] = [];
  for (const name of files) {
    const done = await db.tx(async (t) => {
      // Evita duas instâncias da API migrando ao mesmo tempo.
      await t.query(`select pg_advisory_xact_lock(724519)`);
      const exists = await t.query(`select 1 from schema_migrations where name = $1`, [name]);
      if (exists.length) return false;
      const sql = await readFile(path.join(MIGRATIONS, name), 'utf8');
      for (const stmt of splitStatements(sql)) await t.query(stmt);
      await t.query(`insert into schema_migrations (name) values ($1)`, [name]);
      return true;
    });
    if (done) applied.push(name);
  }
  return applied;
}

/** Separa o arquivo em comandos (as migrações não usam funções com ';' interno). */
function splitStatements(sql: string): string[] {
  return sql
    .split('\n')
    .filter((l) => !l.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
}
