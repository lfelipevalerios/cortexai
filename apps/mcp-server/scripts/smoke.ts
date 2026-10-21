// Smoke test: sobe o servidor no próprio processo (porta livre), conecta com o
// cliente oficial do SDK via Streamable HTTP e exercita leitura e escrita.
// Uso: pnpm --filter @cortex/mcp-server smoke   (TOKEN=ctx_ws-saude_dev_demo para outro workspace)
import type { AddressInfo } from 'node:net';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createHttpServer } from '../src/server.js';
import { parseToken } from '../src/auth.js';
import { store, wsOf } from '../src/store.js';
import { applyFixture } from './fixture.js';

const TOKEN = process.env.TOKEN ?? 'ctx_ws-telecom_dev_demo';
const seedWasEmpty = store.isEmpty();
if (seedWasEmpty && process.env.SMOKE_FIXTURE !== '0') {
  // Seed ainda é um stub: injeta uma fixture mínima para exercitar o caminho completo.
  applyFixture(wsOf(parseToken(TOKEN)!));
  console.log('aviso: @cortex/seed vazio; usando fixture mínima do smoke test (SMOKE_FIXTURE=0 desliga)');
}
let failures = 0;
const check = (cond: unknown, label: string) => {
  console.log(`${cond ? '  ok ' : '  FALHOU'} ${label}`);
  if (!cond) failures++;
};
const parse = (r: any) => JSON.parse(r.content?.[0]?.text ?? 'null');

const http = createHttpServer();
await new Promise<void>((resolve) => http.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
console.log(`servidor em ${base} | workspaces no seed: ${store.workspaceIds().join(', ') || '(seed vazio)'}`);

try {
  console.log('\n# HTTP');
  const health = await (await fetch(`${base}/health`)).json();
  check(health.status === 'ok', `/health → ${JSON.stringify(health)}`);
  const noAuth = await fetch(`${base}/mcp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  check(noAuth.status === 401, `POST /mcp sem token → ${noAuth.status}`);
  const badAuth = await fetch(`${base}/mcp`, { method: 'POST', headers: { authorization: 'Bearer abc', 'content-type': 'application/json' }, body: '{}' });
  check(badAuth.status === 401, `POST /mcp com token inválido → ${badAuth.status}`);

  console.log(`\n# MCP (token ${TOKEN})`);
  const client = new Client({ name: 'cortex-smoke', version: '0.0.1' });
  const transport = new StreamableHTTPClientTransport(new URL(`${base}/mcp`), {
    requestInit: { headers: { Authorization: `Bearer ${TOKEN}` } },
  });
  await client.connect(transport);
  check(true, `conectado: ${JSON.stringify(client.getServerVersion())}`);

  const { tools } = await client.listTools();
  console.log(`  ferramentas (${tools.length}): ${tools.map((t) => t.name).join(', ')}`);
  const expected = ['obter_ordem', 'buscar_regra', 'obter_contrato', 'listar_componentes', 'consultar_conhecimento', 'validar_contra_padroes',
    'registrar_plano', 'registrar_progresso', 'registrar_evidencia', 'propor_mudanca', 'salvar_rascunho_jornada', 'registrar_validacao', 'criar_historia_itsm'];
  check(expected.every((n) => tools.some((t) => t.name === n)), 'todas as 13 ferramentas da seção 8 presentes');

  const { resources } = await client.listResources();
  const { resourceTemplates } = await client.listResourceTemplates();
  console.log(`  recursos: ${resources.length} | templates: ${resourceTemplates.map((t) => t.uriTemplate).join(', ')}`);
  const kinds = resources.reduce<Record<string, number>>((acc, r) => {
    const k = r.uri.split('/')[3] ?? 'indice';
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`  por tipo: ${JSON.stringify(kinds)}`);
  const indice = resources.find((r) => r.uri.endsWith('/indice')) ?? { uri: `cortex://${TOKEN.split('_')[1]}/indice` };
  const idx = await client.readResource({ uri: indice.uri });
  check(idx.contents.length === 1, `leu ${indice.uri} (${String((idx.contents[0] as any).text).split('\n').length} linhas)`);
  const firstRule = resources.find((r) => r.uri.includes('/regras/'));
  if (firstRule) {
    const rr = await client.readResource({ uri: firstRule.uri });
    check(String((rr.contents[0] as any).text).length > 0, `leu ${firstRule.uri}`);
  }

  const { prompts } = await client.listPrompts();
  console.log(`  prompts: ${prompts.map((p) => p.name).join(', ')}`);
  check(prompts.some((p) => p.name === 'implementar_historia') && prompts.some((p) => p.name === 'revisar_codigo'), 'prompts implementar_historia e revisar_codigo');
  const pr = await client.getPrompt({ name: 'revisar_codigo', arguments: { codigo: 'console.log(cliente.cpf)' } });
  check(pr.messages.length === 1, 'getPrompt revisar_codigo');

  console.log('\n# listar_componentes');
  const comps = parse(await client.callTool({ name: 'listar_componentes', arguments: {} }));
  console.log(`  total: ${comps.total}`);
  for (const c of comps.componentes.slice(0, 5)) console.log(`   - [${c.tipo}] ${c.nome} v${c.versao} (${c.status})`);
  const homolog = parse(await client.callTool({ name: 'listar_componentes', arguments: { status: 'homologado', tipo: 'skill' } }));
  check(homolog.componentes.every((c: any) => c.status === 'homologado' && c.tipo === 'skill'), `filtro tipo=skill status=homologado → ${homolog.total}`);

  console.log('\n# validar_contra_padroes');
  const code = [
    'const API_KEY = "sk-live-1234567890abcdefgh";',
    'logger.info("cliente", cliente.cpf, cliente.email);',
    'res.json({ cpf: cliente.cpf });',
    'logger.info("cliente", mascararCpf(cliente.cpf));',
  ].join('\n');
  const val = parse(await client.callTool({ name: 'validar_contra_padroes', arguments: { codigo: code, caminhoArquivo: 'src/atendimento.ts' } }));
  for (const v of val.violacoes) console.log(`   - linha ${v.linha}: ${v.regra} ← ${v.origem.tipo}:${v.origem.nome}`);
  check(val.violacoes.length >= 3 && !val.violacoes.some((v: any) => v.linha === 4), 'detecta PII em log/resposta e segredo; aceita CPF mascarado');

  console.log('\n# obter_ordem + registrar_progresso');
  const ordemRes = await client.callTool({ name: 'obter_ordem', arguments: {} });
  const ordem = parse(ordemRes);
  if (ordemRes.isError) {
    console.log(`  sem OC disponível: ${ordem.erro}`);
    const pg = await client.callTool({ name: 'registrar_progresso', arguments: { ordemId: 'oc-inexistente', nodeId: 'n1' } });
    check(pg.isError === true, `registrar_progresso com OC inexistente devolve erro tratado: ${parse(pg).erro}`);
  } else {
    const o = ordem.ordem;
    console.log(`  OC ${o.id} | jornada ${o.journeyId} v${o.journeyVersion} | status ${o.status} | progresso ${ordem.progresso.construidos}/${ordem.progresso.total}`);
    console.log(`  regras: ${ordem.especificacaoFuncional?.regras.length ?? 0} | contratos: ${ordem.contratos.length} | casos de teste: ${ordem.casosDeTeste.length}`);
    const plano = parse(await client.callTool({ name: 'registrar_plano', arguments: { ordemId: o.id, passos: ['Implementar gatilho', 'Implementar agente', 'Testes'] } }));
    check(plano.status === 'plano_registrado', `registrar_plano → ${plano.status}`);
    const nodeId = ordem.progresso.pendentes[0] ?? ordem.grafo?.nodes?.[0]?.id;
    const pg = parse(await client.callTool({ name: 'registrar_progresso', arguments: { ordemId: o.id, nodeId, nota: 'smoke' } }));
    check(pg.estado === 'construido', `registrar_progresso ${nodeId} → ${pg.progresso?.construidos}/${pg.progresso?.total} (status ${pg.status})`);
    const bad = await client.callTool({ name: 'registrar_progresso', arguments: { ordemId: o.id, nodeId: 'no-que-nao-existe' } });
    check(bad.isError === true, 'registrar_progresso rejeita nó inexistente');
  }

  console.log('\n# salvar_rascunho_jornada');
  const draft = parse(await client.callTool({
    name: 'salvar_rascunho_jornada',
    arguments: {
      nome: 'Rascunho smoke', dominioId: 'atendimento',
      grafo: {
        nodes: [
          { id: 'n1', kind: 'gatilho.mensagem', label: 'Mensagem no WhatsApp' },
          { id: 'n2', kind: 'agente.intencao', label: 'Classificar intenção' },
          { id: 'n3', kind: 'saida.responder', label: 'Responder', emitsPii: true },
        ],
        edges: [{ source: 'n1', target: 'n2' }, { source: 'n2', target: 'n3' }],
      },
    },
  }));
  check(draft.jornadaId, `rascunho ${draft.jornadaId} v${draft.versao}; avisos: ${draft.avisos?.length}`);

  console.log('\n# telemetria');
  const tel = parse(await client.callTool({ name: 'obter_telemetria', arguments: {} }));
  const byTool = tel.eventos.reduce((acc: Record<string, number>, e: any) => ((acc[`${e.kind}:${e.tool}`] = (acc[`${e.kind}:${e.tool}`] ?? 0) + 1), acc), {});
  console.log(`  ${tel.total} eventos: ${JSON.stringify(byTool)}`);
  check(tel.eventos.some((e: any) => e.tool === 'listar_componentes' && e.project === TOKEN.split('_')[3]), 'telemetria registra ferramenta + projeto do token');

  await client.close();
} catch (err) {
  failures++;
  console.error('ERRO no smoke test:', err);
} finally {
  http.close();
}

console.log(failures ? `\nSMOKE FALHOU (${failures})` : '\nSMOKE OK');
process.exit(failures ? 1 : 0);
