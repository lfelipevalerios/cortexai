// Exemplos leves para os 4 workspaces: só o suficiente para mostrar a estrutura.
import { emptyCapabilities, emptyContent, type BusinessFront, type Journey, type Workspace } from '@cortex/schemas';

function journey(id: string, name: string, summary: string, design = '', arquitetura = ''): Journey {
  const capabilities = emptyCapabilities();
  capabilities.arquitetura = emptyContent(arquitetura);
  return { id, name, summary, content: emptyContent(), design: emptyContent(design), capabilities };
}

function front(id: string, name: string, summary: string, journeys: Journey[]): BusinessFront {
  return { id, name, summary, content: emptyContent(), journeys };
}

export function seedWorkspaces(): Workspace[] {
  return [
    {
      id: 'ws-saude',
      name: 'Rede Sanare',
      segment: 'Saúde',
      tagline: 'Rede hospitalar',
      brain: {
        core: emptyContent('Rede com 6 hospitais e 14 clínicas. Atende convênios e particulares.'),
        fronts: [
          front('sau-atendimento', 'Atendimento ao paciente', 'Do agendamento à alta.', [
            journey('sau-agendamento', 'Agendamento de exames', 'Paciente agenda pelo WhatsApp com pré-autorização.', '1. Paciente pede o exame\n2. Verifica cobertura\n3. Confirma horário'),
          ]),
          front('sau-faturamento', 'Faturamento', 'Contas e relacionamento com operadoras.', []),
        ],
      },
    },
    {
      id: 'ws-varejo',
      name: 'Aurora Varejo',
      segment: 'Varejo',
      tagline: 'Varejista omnichannel',
      brain: {
        core: emptyContent('120 lojas físicas e e-commerce. Casa, cozinha e tecnologia.'),
        fronts: [
          front('var-pos-venda', 'Pós-venda', 'Trocas, devoluções e garantia.', [
            journey('var-troca', 'Troca e devolução', 'Cliente solicita troca pelo app.'),
          ]),
          front('var-vendas', 'Vendas digitais', 'Jornada de compra on-line.', []),
        ],
      },
    },
    {
      id: 'ws-financeiro',
      name: 'Banco Lumen',
      segment: 'Financeiro',
      tagline: 'Banco digital',
      brain: {
        core: emptyContent('Banco digital para pessoas e pequenas empresas. 2 milhões de clientes.'),
        fronts: [
          front('fin-pagamentos', 'Pagamentos', 'PIX, boletos e cartões.', [
            journey('fin-contestacao-pix', 'Contestação de PIX', 'Cliente contesta um PIX pelo app.'),
          ]),
        ],
      },
    },
    {
      id: 'ws-telecom',
      name: 'Onda Telecom',
      segment: 'Telecom',
      tagline: 'Operadora fixa e móvel',
      brain: {
        core: emptyContent('Operadora regional com 1,2 milhão de linhas. Foco em pessoas e PME.'),
        fronts: [
          front('tel-atendimento-pme', 'Atendimento PME', 'Relacionamento com pequenas empresas.', [
            journey(
              'tel-segunda-via',
              'Segunda via de fatura',
              'Cliente PME pede a segunda via pelo WhatsApp.',
              '1. Cliente pede a segunda via\n2. Identificação pelo número\n3. Envio do boleto',
              'API de faturamento (REST) e WhatsApp Business API.',
            ),
            journey('tel-contestacao', 'Contestação de fatura', 'Cliente contesta uma cobrança.'),
          ]),
          front('tel-retencao', 'Retenção', 'Evitar cancelamentos.', []),
        ],
      },
    },
  ];
}
