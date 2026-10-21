import { createHttpServer } from './server.js';
import { store } from './store.js';

const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? '127.0.0.1';

const http = createHttpServer();
http.listen(port, host, () => {
  const ws = store.workspaceIds();
  console.log(`[cortex-mcp] ouvindo em http://${host}:${port}/mcp`);
  console.log(ws.length ? `[cortex-mcp] workspaces carregados: ${ws.join(', ')}` : '[cortex-mcp] aviso: seed vazio, as ferramentas devolvem listas vazias');
  if (process.env.CORTEX_ALLOW_ANON === '1') console.log('[cortex-mcp] acesso anônimo habilitado (CORTEX_ALLOW_ANON=1)');
});

const shutdown = () => http.close(() => process.exit(0));
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
