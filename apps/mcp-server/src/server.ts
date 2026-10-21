// Servidor MCP do Córtex sobre Streamable HTTP (modo sem sessão: um McpServer por
// requisição, com o escopo do token fechado no closure).
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { authenticate } from './auth.js';
import { registerPrompts } from './prompts.js';
import { registerResources } from './resources.js';
import { store, type Scope } from './store.js';
import { ToolError, fail, ok, registerTools } from './tools.js';

export const SERVER_NAME = 'cortex';
export const SERVER_VERSION = '0.1.0';

const INSTRUCTIONS = [
  'Servidor MCP do Córtex: fonte da verdade do projeto (cérebro, catálogo, jornadas, contratos e políticas).',
  'Use as ferramentas de leitura (obter_ordem, buscar_regra, obter_contrato, listar_componentes, consultar_conhecimento) antes de escrever código ou desenhar jornadas,',
  'rode validar_contra_padroes a cada etapa, e reporte plano, progresso e evidências pelas ferramentas de escrita.',
  'Nunca altere regra, contrato ou jornada por conta própria: use propor_mudanca.',
].join(' ');

export function createMcpServer(scope: Scope): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { resources: {}, tools: {}, prompts: {} }, instructions: INSTRUCTIONS },
  );

  const telemetry = (tool: string, okFlag: boolean, durationMs?: number, detail?: string) =>
    store.record({ kind: 'telemetria', tool, workspaceId: scope.workspaceId, env: scope.env, project: scope.project, ok: okFlag, durationMs, detail });

  const run = async (tool: string, fn: () => unknown | Promise<unknown>) => {
    const t0 = Date.now();
    try {
      const data = await fn();
      telemetry(tool, true, Date.now() - t0);
      return ok(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      telemetry(tool, false, Date.now() - t0, msg);
      return fail(msg, err instanceof ToolError ? err.extra : undefined);
    }
  };

  const writeEvent = (tool: string, object: string, detail: string) =>
    store.record({ kind: 'escrita', tool, workspaceId: scope.workspaceId, env: scope.env, project: scope.project, object, detail });

  registerTools(server, scope, run, writeEvent);
  registerResources(server, scope, (uri, okFlag) => telemetry(`resource:${uri}`, okFlag));
  registerPrompts(server, scope, (name) => telemetry(name, true));
  return server;
}

function sendJson(res: ServerResponse, status: number, body: unknown, extraHeaders: Record<string, string> = {}) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', ...extraHeaders });
  res.end(JSON.stringify(body));
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type, mcp-session-id, mcp-protocol-version, last-event-id',
  'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
  'access-control-expose-headers': 'mcp-session-id',
};

async function handleMcp(req: IncomingMessage, res: ServerResponse) {
  const auth = authenticate(req);
  if (!auth.ok) {
    sendJson(res, 401, { jsonrpc: '2.0', error: { code: -32001, message: auth.message }, id: null }, { ...CORS, 'www-authenticate': 'Bearer realm="cortex"' });
    return;
  }
  if (req.method !== 'POST') {
    // Modo sem sessão: não há stream SSE de servidor (GET) nem sessão a encerrar (DELETE).
    sendJson(res, 405, { jsonrpc: '2.0', error: { code: -32000, message: 'Método não permitido no modo sem sessão. Use POST.' }, id: null }, { ...CORS, allow: 'POST' });
    return;
  }
  const server = createMcpServer(auth.scope);
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on('close', () => {
    void transport.close();
    void server.close();
  });
  for (const [k, v] of Object.entries(CORS)) res.setHeader(k, v);
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res);
  } catch (err) {
    console.error('[cortex-mcp] erro ao tratar requisição:', err);
    if (!res.headersSent) sendJson(res, 500, { jsonrpc: '2.0', error: { code: -32603, message: 'Erro interno do servidor' }, id: null });
  }
}

export function createHttpServer(): Server {
  return createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (req.method === 'OPTIONS') {
      res.writeHead(204, CORS);
      res.end();
      return;
    }
    if (url.pathname === '/health' && req.method === 'GET') {
      sendJson(res, 200, {
        status: 'ok',
        server: SERVER_NAME,
        version: SERVER_VERSION,
        workspaces: store.workspaceIds(),
        seedVazio: store.isEmpty(),
        eventos: store.events({ limit: 1_000_000 }).length,
      }, CORS);
      return;
    }
    if (url.pathname === '/events' && req.method === 'GET') {
      // Feed para o Córtex (tela de IDEs e telemetria): mesmo escopo do token.
      const auth = authenticate(req);
      if (!auth.ok) return sendJson(res, 401, { erro: auth.message }, CORS);
      const since = url.searchParams.get('since') ?? undefined;
      return sendJson(res, 200, { eventos: store.events({ workspaceId: auth.scope.workspaceId, since, limit: 500 }) }, CORS);
    }
    if (url.pathname === '/mcp') {
      void handleMcp(req, res);
      return;
    }
    sendJson(res, 404, { erro: 'Rota não encontrada. Use /mcp, /health ou /events.' }, CORS);
  });
}
