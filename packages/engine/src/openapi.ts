// Importação de especificação OpenAPI 3.x (e Swagger 2.0 básico) em tools e objetos.
import type { ConnectorTool, DiscoveredField, DiscoveredObject } from '@cortex/schemas';

export interface OpenApiImport {
  title: string;
  version: string;
  baseUrl?: string;
  tools: ConnectorTool[];
  objects: DiscoveredObject[];
  errors: string[];
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v : undefined);

const METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'] as const;
const PII_TOKENS = new Set([
  'cpf', 'cnpj', 'email', 'mail', 'telefone', 'phone', 'celular', 'nome', 'sobrenome', 'name',
  'endereco', 'address', 'logradouro', 'cep', 'birth', 'birthdate', 'birthday', 'nascimento', 'rg',
]);

/** camelCase, kebab e acentos → snake_case. */
export function slugifySnake(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_')
    .toLowerCase();
}

function nameFromPath(method: string, path: string): string {
  const segs = path.split('/').filter(Boolean);
  const last = segs[segs.length - 1] ?? '';
  const endsWithParam = /^\{.+\}$/.test(last);
  const verb =
    method === 'get'
      ? endsWithParam
        ? 'consultar'
        : 'listar'
      : method === 'post'
        ? 'criar'
        : method === 'put' || method === 'patch'
          ? 'atualizar'
          : method === 'delete'
            ? 'remover'
            : method === 'head'
              ? 'verificar'
              : method;
  const words = segs.filter((s) => !/^\{.+\}$/.test(s));
  let name = [verb, ...words].join('_');
  if (endsWithParam) name += `_por_${last.slice(1, -1)}`;
  return slugifySnake(name);
}

export function isPiiFieldName(name: string): boolean {
  return slugifySnake(name).split('_').some((t) => PII_TOKENS.has(t));
}

function refName(ref: string): string {
  return ref.split('/').pop() ?? ref;
}

function typeOf(schema: unknown): string {
  if (!isObj(schema)) return 'any';
  if (typeof schema.$ref === 'string') return refName(schema.$ref);
  if (schema.type === 'array') return `array<${typeOf(schema.items)}>`;
  const t = str(schema.type) ?? (isObj(schema.properties) ? 'object' : 'any');
  const f = str(schema.format);
  return f ? `${t}(${f})` : t;
}

function objectFromSchema(name: string, schema: unknown): DiscoveredObject | null {
  if (!isObj(schema)) return null;
  // allOf simples: junta as propriedades.
  const parts = Array.isArray(schema.allOf) ? (schema.allOf.filter(isObj) as Obj[]) : [schema];
  const props: Obj = {};
  for (const p of parts) if (isObj(p.properties)) Object.assign(props, p.properties);
  const fields: DiscoveredField[] = Object.entries(props).map(([fname, fs]) => ({
    name: fname,
    type: typeOf(fs),
    ...(isPiiFieldName(fname) ? { pii: true } : {}),
  }));
  const sampleRow: Record<string, string | number | boolean | null> = {};
  let hasExample = false;
  for (const [fname, fs] of Object.entries(props)) {
    if (isObj(fs) && ['string', 'number', 'boolean'].includes(typeof fs.example)) {
      sampleRow[fname] = fs.example as string | number | boolean;
      hasExample = true;
    }
  }
  const example = isObj(schema.example) ? schema.example : null;
  const sample = example
    ? [Object.fromEntries(Object.entries(example).filter(([, v]) => v === null || ['string', 'number', 'boolean'].includes(typeof v))) as Record<string, string | number | boolean | null>]
    : hasExample
      ? [sampleRow]
      : [];
  return { name, kind: 'objeto', records: 0, fields, sample };
}

export function parseOpenApi(spec: unknown): OpenApiImport {
  const errors: string[] = [];
  let doc: unknown = spec;
  if (typeof spec === 'string') {
    try {
      doc = JSON.parse(spec);
    } catch {
      return { title: '', version: '', tools: [], objects: [], errors: ['A especificação não é um JSON válido'] };
    }
  }
  if (!isObj(doc)) return { title: '', version: '', tools: [], objects: [], errors: ['Especificação vazia ou inválida'] };

  const oas = str(doc.openapi);
  const swagger = str(doc.swagger);
  if (!oas && !swagger) errors.push('Campo "openapi" ou "swagger" ausente; tentando ler mesmo assim');
  else if (oas && !oas.startsWith('3')) errors.push(`Versão OpenAPI ${oas} não suportada; esperado 3.x`);
  else if (swagger && !swagger.startsWith('2')) errors.push(`Versão Swagger ${swagger} não suportada; esperado 2.0`);

  const info = isObj(doc.info) ? doc.info : {};
  const title = str(info.title) ?? 'API sem título';
  const version = str(info.version) ?? '0.0.0';
  if (!isObj(doc.info)) errors.push('Bloco "info" ausente');

  let baseUrl: string | undefined;
  if (Array.isArray(doc.servers) && isObj(doc.servers[0])) baseUrl = str(doc.servers[0].url);
  else if (str(doc.host)) {
    const scheme = Array.isArray(doc.schemes) && typeof doc.schemes[0] === 'string' ? doc.schemes[0] : 'https';
    baseUrl = `${scheme}://${doc.host}${str(doc.basePath) ?? ''}`;
  }

  const tools: ConnectorTool[] = [];
  const used = new Set<string>();
  if (!isObj(doc.paths) || !Object.keys(doc.paths).length) errors.push('Nenhuma operação encontrada em "paths"');
  else {
    for (const [path, item] of Object.entries(doc.paths)) {
      if (!isObj(item)) continue;
      for (const method of METHODS) {
        const op = item[method];
        if (!isObj(op)) continue;
        let name = str(op.operationId) ? slugifySnake(op.operationId as string) : nameFromPath(method, path);
        if (!name) name = nameFromPath(method, path);
        let unique = name;
        for (let i = 2; used.has(unique); i++) unique = `${name}_${i}`;
        used.add(unique);
        const mode: ConnectorTool['mode'] = method === 'get' || method === 'head' ? 'leitura' : 'escrita';
        tools.push({
          id: unique,
          name: unique,
          description: str(op.summary) ?? str(op.description) ?? `${method.toUpperCase()} ${path}`,
          mode,
          enabledByEnv: { dev: true, hml: true, prd: mode === 'leitura' },
        });
      }
    }
  }

  const schemas = isObj(doc.components) && isObj(doc.components.schemas) ? doc.components.schemas : isObj(doc.definitions) ? doc.definitions : {};
  const objects: DiscoveredObject[] = [];
  for (const [name, schema] of Object.entries(schemas)) {
    const o = objectFromSchema(name, schema);
    if (o) objects.push(o);
    else errors.push(`Esquema "${name}" ignorado: formato inválido`);
  }

  return { title, version, baseUrl, tools, objects, errors };
}

/** Especificação de exemplo usada na demo (conector REST/OpenAPI). */
export const SAMPLE_OPENAPI_SPEC = {
  openapi: '3.0.3',
  info: {
    title: 'API de Faturas',
    version: '2.4.0',
    description: 'Consulta e gestão de faturas de clientes, segunda via e contestações.',
  },
  servers: [{ url: 'https://api.exemplo.com.br/faturas/v2' }],
  paths: {
    '/clientes/{clienteId}/faturas': {
      get: {
        operationId: 'listarFaturasDoCliente',
        summary: 'Lista as faturas de um cliente, da mais recente para a mais antiga',
        parameters: [{ name: 'clienteId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'OK', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Fatura' } } } } } },
      },
    },
    '/faturas/{faturaId}': {
      get: {
        operationId: 'consultarFatura',
        summary: 'Consulta os detalhes de uma fatura',
        parameters: [{ name: 'faturaId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/Fatura' } } } } },
      },
    },
    '/faturas/{faturaId}/segunda-via': {
      post: {
        operationId: 'gerarSegundaVia',
        summary: 'Gera a segunda via da fatura com código de barras e Pix atualizados',
        parameters: [{ name: 'faturaId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '201': { description: 'Segunda via gerada' } },
      },
    },
    '/faturas/{faturaId}/contestacoes': {
      post: {
        operationId: 'abrirContestacao',
        summary: 'Abre contestação de valor cobrado na fatura',
        responses: { '201': { description: 'Contestação registrada' } },
      },
    },
    '/clientes/{clienteId}': {
      get: {
        operationId: 'consultarCliente',
        summary: 'Consulta o cadastro do cliente titular',
        responses: { '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/Cliente' } } } } },
      },
      patch: {
        operationId: 'atualizarEmailDeCobranca',
        summary: 'Atualiza o e-mail de envio da fatura',
        responses: { '204': { description: 'Atualizado' } },
      },
    },
  },
  components: {
    schemas: {
      Fatura: {
        type: 'object',
        required: ['id', 'clienteId', 'valor', 'vencimento', 'status'],
        properties: {
          id: { type: 'string', example: 'FAT-2026-10-88412' },
          clienteId: { type: 'string', example: 'CLI-004219' },
          competencia: { type: 'string', example: '2026-10' },
          valor: { type: 'number', format: 'double', example: 189.9 },
          vencimento: { type: 'string', format: 'date', example: '2026-10-28' },
          status: { type: 'string', enum: ['aberta', 'paga', 'vencida', 'contestada'], example: 'aberta' },
          linhaDigitavel: { type: 'string', example: '34191.79001 01043.510047 91020.150008 1 99990000018990' },
        },
      },
      Cliente: {
        type: 'object',
        required: ['id', 'nome', 'cpf'],
        properties: {
          id: { type: 'string', example: 'CLI-004219' },
          nome: { type: 'string', example: 'Marina Albuquerque' },
          cpf: { type: 'string', example: '123.456.789-09' },
          email: { type: 'string', format: 'email', example: 'marina.albuquerque@exemplo.com.br' },
          telefone: { type: 'string', example: '(11) 98765-4321' },
          plano: { type: 'string', example: 'Controle 25 GB' },
          dataNascimento: { type: 'string', format: 'date', example: '1988-03-14' },
        },
      },
    },
  },
} as const;
