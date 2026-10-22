import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Conteúdo dos arquivos: Supabase Storage (bucket privado) em produção;
// pasta local no desenvolvimento.

export interface Storage {
  put(key: string, data: Buffer, mime: string): Promise<void>;
  /** URL temporária (Supabase) ou o próprio conteúdo (local). */
  get(key: string, downloadName: string): Promise<{ url: string } | { data: Buffer }>;
  kind: 'supabase' | 'local';
}

export async function createStorage(): Promise<Storage> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_BUCKET ?? 'cortex-files';

  if (url && key) {
    const { createClient } = await import('@supabase/supabase-js');
    const sb = createClient(url, key, { auth: { persistSession: false } });
    const { data: buckets } = await sb.storage.listBuckets();
    if (!buckets?.some((b) => b.name === bucket)) {
      const { error } = await sb.storage.createBucket(bucket, { public: false });
      if (error && !/already exists/i.test(error.message)) throw new Error(`Storage: ${error.message}`);
    }
    return {
      kind: 'supabase',
      async put(k, data, mime) {
        const { error } = await sb.storage.from(bucket).upload(k, data, { contentType: mime, upsert: false });
        if (error) throw new Error(`Storage: ${error.message}`);
      },
      async get(k, downloadName) {
        const { data, error } = await sb.storage.from(bucket).createSignedUrl(k, 300, { download: downloadName });
        if (error || !data) throw new Error(`Storage: ${error?.message ?? 'sem URL'}`);
        return { url: data.signedUrl };
      },
    };
  }

  const root = path.resolve(process.env.LOCAL_FILES_DIR ?? '.data/files');
  return {
    kind: 'local',
    async put(k, data) {
      const p = path.join(root, k);
      await mkdir(path.dirname(p), { recursive: true });
      await writeFile(p, data);
    },
    async get(k) {
      return { data: await readFile(path.join(root, k)) };
    },
  };
}
