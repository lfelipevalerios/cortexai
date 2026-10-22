// Workspaces de exemplo, com poucas frentes e jornadas.
import type { Repo } from './repo.ts';

interface SeedJourney { name: string; summary: string; design?: string }
interface SeedWorkspace { name: string; segment: string; tagline: string; core: string; fronts: { name: string; summary: string; journeys: SeedJourney[] }[] }

const DATA: SeedWorkspace[] = [
  {
    name: 'Rede Sanare', segment: 'Saúde', tagline: 'Rede hospitalar',
    core: 'Rede com 6 hospitais e 14 clínicas. Atende convênios e particulares.',
    fronts: [
      { name: 'Atendimento ao paciente', summary: 'Do agendamento à alta.', journeys: [{ name: 'Agendamento de exames', summary: 'Paciente agenda pelo WhatsApp com pré-autorização.' }] },
      { name: 'Faturamento', summary: 'Contas e relacionamento com operadoras.', journeys: [] },
    ],
  },
  {
    name: 'Aurora Varejo', segment: 'Varejo', tagline: 'Varejista omnichannel',
    core: '120 lojas físicas e e-commerce. Casa, cozinha e tecnologia.',
    fronts: [
      { name: 'Pós-venda', summary: 'Trocas, devoluções e garantia.', journeys: [{ name: 'Troca e devolução', summary: 'Cliente solicita troca pelo app.' }] },
      { name: 'Vendas digitais', summary: 'Jornada de compra on-line.', journeys: [] },
    ],
  },
  {
    name: 'Banco Lumen', segment: 'Financeiro', tagline: 'Banco digital',
    core: 'Banco digital para pessoas e pequenas empresas. 2 milhões de clientes.',
    fronts: [{ name: 'Pagamentos', summary: 'PIX, boletos e cartões.', journeys: [{ name: 'Contestação de PIX', summary: 'Cliente contesta um PIX pelo app.' }] }],
  },
  {
    name: 'Onda Telecom', segment: 'Telecom', tagline: 'Operadora fixa e móvel',
    core: 'Operadora regional com 1,2 milhão de linhas. Foco em pessoas e PME.',
    fronts: [
      {
        name: 'Atendimento PME', summary: 'Relacionamento com pequenas empresas.',
        journeys: [
          { name: 'Segunda via de fatura', summary: 'Cliente PME pede a segunda via pelo WhatsApp.', design: '1. Cliente pede a segunda via\n2. Identificação pelo número\n3. Envio do boleto' },
          { name: 'Contestação de fatura', summary: 'Cliente contesta uma cobrança.' },
        ],
      },
      { name: 'Retenção', summary: 'Evitar cancelamentos.', journeys: [] },
    ],
  },
];

const AUTHOR = 'Carga inicial';

/** Cria os exemplos só se ainda não houver nenhum workspace. Devolve quantos criou. */
export async function seedIfEmpty(repo: Repo): Promise<number> {
  if ((await repo.listWorkspaces()).length > 0) return 0;
  for (const w of DATA) {
    const ws = await repo.createWorkspace({ name: w.name, segment: w.segment, tagline: w.tagline }, AUTHOR);
    const tree = await repo.getTree(ws.id);
    await repo.updateNode(tree.core.id, { body: w.core, note: 'Carga inicial' }, AUTHOR);
    for (const f of w.fronts) {
      const frontId = await repo.createNode({ parentId: tree.core.id, kind: 'front', name: f.name, summary: f.summary }, AUTHOR);
      for (const j of f.journeys) {
        const journeyId = await repo.createNode({ parentId: frontId, kind: 'journey', name: j.name, summary: j.summary }, AUTHOR);
        if (!j.design) continue;
        const t = await repo.getTree(ws.id);
        const design = t.core.children.find((x) => x.id === frontId)!.children.find((x) => x.id === journeyId)!.children.find((x) => x.kind === 'design')!;
        await repo.updateNode(design.id, { body: j.design, note: 'Carga inicial' }, AUTHOR);
      }
    }
  }
  return DATA.length;
}
