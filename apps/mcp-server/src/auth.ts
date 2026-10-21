// Token pessoal do Córtex. No protótipo o formato é legível:
//   ctx_<workspaceId>_<env>_<projeto ou qualquer sufixo>
// ex.: ctx_ws-telecom_dev_demo → { workspaceId: 'ws-telecom', env: 'dev', project: 'demo' }
// Na versão real o token é opaco, emitido pela tela "IDEs & MCP" com validade e escopo.
import type { IncomingMessage } from 'node:http';
import type { EnvId } from '@cortex/schemas';
import { store, type Scope } from './store.js';

const TOKEN_RE = /^ctx_([A-Za-z0-9-]+)_(dev|hml|prd)(?:_([A-Za-z0-9._-]+))?$/;

export type AuthResult = { ok: true; scope: Scope } | { ok: false; status: 401; message: string };

export function parseToken(token: string): Scope | null {
  const m = TOKEN_RE.exec(token.trim());
  if (!m) return null;
  return { workspaceId: m[1], env: m[2] as EnvId, project: m[3] ?? 'padrao' };
}

export function authenticate(req: IncomingMessage): AuthResult {
  const header = req.headers['authorization'];
  const value = Array.isArray(header) ? header[0] : header;

  if (!value) {
    if (process.env.CORTEX_ALLOW_ANON === '1') {
      return {
        ok: true,
        scope: {
          workspaceId: process.env.CORTEX_ANON_WORKSPACE ?? 'ws-telecom',
          env: (process.env.CORTEX_ANON_ENV as EnvId | undefined) ?? 'dev',
          project: 'anonimo',
          anonymous: true,
        },
      };
    }
    return { ok: false, status: 401, message: 'Token ausente. Envie o header "Authorization: Bearer ctx_<workspace>_<env>_<projeto>".' };
  }

  const m = /^Bearer\s+(.+)$/i.exec(value);
  if (!m) return { ok: false, status: 401, message: 'Header Authorization deve usar o esquema Bearer.' };

  const scope = parseToken(m[1]);
  if (!scope) return { ok: false, status: 401, message: 'Token inválido. Formato esperado: ctx_<workspaceId>_<dev|hml|prd>_<projeto>.' };

  // Com o seed carregado, o workspace precisa existir. Com o seed vazio, aceitamos
  // o escopo para que o servidor continue respondendo (listas vazias).
  if (!store.isEmpty() && !store.workspaceIds().includes(scope.workspaceId)) {
    return { ok: false, status: 401, message: `Workspace "${scope.workspaceId}" não existe. Disponíveis: ${store.workspaceIds().join(', ')}.` };
  }
  return { ok: true, scope };
}
