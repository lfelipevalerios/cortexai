// Fixture mínima usada pelo smoke test só quando o seed (@cortex/seed) ainda está vazio,
// para exercitar o caminho completo de leitura e escrita. Não é carregada pelo servidor.
import type { WorkspaceData } from '@cortex/schemas';

export function applyFixture(ws: WorkspaceData) {
  ws.workspace.company = 'Fixture Telecom';
  ws.brainAreas.push({ id: 'area-arq', side: 'tecnico', name: 'Arquitetura', description: '', owner: 'CoE', updatedAt: '2026-10-01', coverage: 80 });
  ws.artifacts.push(
    { id: 'adr-001', areaId: 'area-arq', kind: 'adr', title: 'ADR-001 Node.js com TypeScript', summary: 'Serviços em Node.js + TypeScript.', tags: ['stack'] },
    { id: 'pad-logs', areaId: 'area-arq', kind: 'padrao', title: 'Logs estruturados sem PII', summary: 'Nunca registrar CPF ou e-mail em log; usar mascaramento.', tags: ['pii', 'log'] },
  );
  ws.radar.push({ name: 'MongoDB', quadrant: 'plataformas', ring: 'evitar' });
  ws.policies.push({
    id: 'pol-pii', name: 'PII mascarada em canais e logs', kind: 'dado', description: 'Dado pessoal (CPF, e-mail) só sai mascarado.',
    condition: 'quando um nó emite PII para canal ou log', effect: 'bloquear', envs: ['dev', 'hml', 'prd'], active: true, code: '{"pii":"mascarar"}',
  });
  ws.decisionTables.push({
    id: 'dt-retencao', name: 'Oferta de retenção', domainId: 'clientes', description: 'Define a oferta de retenção por tempo de casa e ARPU.', version: '1.0',
    inputs: [{ key: 'meses', label: 'Meses de casa', type: 'number' }], outputs: [{ key: 'oferta', label: 'Oferta' }],
    rows: [{ id: 'r1', conditions: { meses: '>=24' }, outputs: { oferta: 'desconto 20%' } }, { id: 'r2', conditions: { meses: '*' }, outputs: { oferta: 'bônus de dados' } }],
    sampleCase: { meses: 30 },
  });
  ws.components.push({
    id: 'cmp-skill-fatura', type: 'skill', name: 'Explicar fatura', version: '1.2.0', status: 'homologado', domainId: 'faturamento', owner: 'CoE',
    consumers: 3, rating: 4.6, description: 'Explica itens da fatura em linguagem simples.', content: '...', inputs: ['faturaId'], outputs: ['explicacao'],
    dependencies: [], changelog: [], evaluation: { score: 92, cases: 50, passed: 46 }, approvals: [],
  });
  ws.journeys.push({
    id: 'jor-retencao', name: 'Retenção no WhatsApp', description: '', type: 'agentica', domainId: 'clientes', triggerLabel: 'Mensagem', risk: 'supervisionada', anchor: true,
    brainInputs: [], envVersions: { dev: '1.0', hml: null, prd: null }, persona: { name: 'Ana', message: 'Quero cancelar' }, script: {}, kpis: [],
    testCases: [{ id: 'tc1', name: 'Cliente antigo', input: 'quero cancelar, sou cliente há 3 anos', expected: 'oferta desconto 20%' }],
    versions: [{
      version: '1.0', createdAt: '2026-10-01', author: 'Champion', note: '',
      graph: {
        nodes: [
          { id: 'n1', kind: 'gatilho.mensagem', category: 'gatilho', label: 'Mensagem WhatsApp', position: { x: 0, y: 0 } },
          { id: 'n2', kind: 'logica.tabela', category: 'logica', label: 'Oferta de retenção', position: { x: 200, y: 0 }, ruleId: 'dt-retencao' },
          { id: 'n3', kind: 'saida.responder', category: 'saida', label: 'Responder', position: { x: 400, y: 0 } },
        ],
        edges: [{ id: 'e1', source: 'n1', target: 'n2' }, { id: 'e2', source: 'n2', target: 'n3' }],
      },
    }],
  });
  ws.buildOrders.push({
    id: 'oc-fixture-1', journeyId: 'jor-retencao', journeyVersion: '1.0', env: 'dev', status: 'na_fila', repo: 'git@exemplo/retencao.git', branch: 'oc/fixture-1',
    createdAt: '2026-10-20T10:00:00Z', definitionOfDone: ['Testes dos casos do Studio passando'], plan: [], progress: {}, evidences: [],
  });
}
