// Aurora Varejo: varejista omnichannel (empresa fictícia).
import type { Channel, DataDomain, DecisionTable, EcosystemSystem } from '@cortex/schemas';
import type { IndustryContent, IndustryMeta, Ctx } from '../common';
import { connector, contract, obj, table, dateAgo, okValidation } from '../common';

const W = 'var';
export const meta: IndustryMeta = {
  industry: 'varejo', p: W, ws: 'ws-varejo', seed: 0x0a0e0a,
  people: {
    patrocinador: 'Fernanda Gomes', dono_negocio: 'Marcos Rezende', champion: 'Sabrina Moreira', engenheiro_ai: 'Lucas Ferraz',
    engenheiro_dados: 'Aline Duarte', coe: 'Rafael Nogueira', seguranca: 'Vanessa Prado', admin: 'Vinícius Barbosa',
  },
  coreName: 'OMS', coreConnectorId: 'var-con-oms', org: 'aurora-varejo', repo: 'jornadas-omnichannel',
};

export const DEMO = {
  anchorJourneyId: 'var-jr-assistente', prdJourneyId: 'var-jr-troca', anchorInitiativeId: 'var-in-01',
  whatsappChannelId: 'var-ch-whatsapp', showcaseDecisionTableId: 'var-dt-troca',
  showcaseQuestion: 'qual o prazo para troca de produto com defeito?', crmSystemId: 'var-sys-crm',
};
export const BREAKING = { contractId: 'var-ct-cliente', field: 'segmento_fidelidade' };

export function crmPreset(ctx: Ctx) {
  return {
    typeId: 'hubspot', name: 'CRM/CDP (HubSpot)', domainId: 'var-dom-cliente',
    endpoint: 'https://api.hubapi.example/crm/v3',
    objects: [
      obj(ctx, 'Contatos', 'objeto', 1840000, [['id', 'string', 'id:CT'], ['nome', 'string', 'nome'], ['cpf', 'string', 'cpf'], ['email', 'string', 'email'], ['telefone', 'string', 'telefone'], ['segmento_fidelidade', 'string', 'enum:Aurora+|Aurora+ Ouro|Sem programa']],
        { row0: { nome: 'Rafael X*****', cpf: '***.913.058-**', telefone: '(11) 9****-7710' } }),
      obj(ctx, 'Interações', 'objeto', 9120000, [['id', 'string', 'id:IN'], ['contato_id', 'string', 'id:CT'], ['canal', 'string', 'enum:WhatsApp|App|Loja|E-commerce'], ['tipo', 'string', 'enum:compra|troca|dúvida|reclamação'], ['ocorrido_em', 'datetime', 'datahora:0:60']]),
      obj(ctx, 'Segmentos', 'objeto', 42, [['segmento_id', 'string', 'id:SG'], ['nome', 'string', 'enum:Casa e cozinha|Moda praia|Tecnologia|Pais de primeira viagem'], ['tamanho', 'integer', 'int:2000:400000']]),
    ],
    tools: [
      { id: 'var-tl-crm-consultar-cliente', name: 'consultar_cliente', description: 'Busca cliente por telefone, e-mail ou CPF.', mode: 'leitura' as const, enabledByEnv: { dev: true, hml: true, prd: true } },
      { id: 'var-tl-crm-historico', name: 'historico_de_compras', description: 'Últimas compras e interações do cliente.', mode: 'leitura' as const, enabledByEnv: { dev: true, hml: true, prd: true } },
      { id: 'var-tl-crm-atualizar-consentimento', name: 'atualizar_consentimento', description: 'Registra opt-in ou opt-out por canal.', mode: 'escrita' as const, enabledByEnv: { dev: true, hml: true, prd: false } },
    ],
  };
}

export function build(ctx: Ctx): IndustryContent {
  const u = ctx.u;
  const D = {
    cliente: 'var-dom-cliente', produto: 'var-dom-produto', estoque: 'var-dom-estoque', pedido: 'var-dom-pedido',
    preco: 'var-dom-preco', loja: 'var-dom-loja', eventos: 'var-dom-eventos', logs: 'var-dom-logs',
  };
  const J = { anchor: 'var-jr-assistente', prd: 'var-jr-troca', auto: 'var-jr-reposicao' };
  const lojas = 'enum:Shopping Paulista|Campinas Centro|Barra|Savassi|Moinhos';

  const connectors = [
    connector(ctx, {
      id: 'var-con-vtex', typeId: 'vtex', name: 'E-commerce · VTEX', domainId: D.produto, syncMode: 'cdc',
      volume: 2380000, latencyMs: 240, consumers: [J.anchor, 'var-ct-produto', 'var-ct-preco'],
      endpoint: 'https://aurora{env}.vtexcommercestable.example/api',
      objects: [
        obj(ctx, 'catalog/sku', 'endpoint', 84200, [['sku', 'string', 'id:SKU-'], ['nome', 'string', 'enum:Air fryer Prática 5L|Liquidificador Turbo 900W|Jogo de panelas Inox 5 peças|Smart TV 50"'], ['categoria', 'string', 'enum:Casa e cozinha|Eletroportáteis|Tecnologia'], ['preco_lista', 'decimal', 'valor:79:3499'], ['ativo', 'boolean', 'bool:0.95']]),
        obj(ctx, 'oms/pedidos', 'endpoint', 2380000, [['pedido_id', 'string', 'id:PED-'], ['cliente_email', 'string', 'email'], ['valor', 'decimal', 'valor:49:4890'], ['status', 'string', 'enum:faturado|entregue|em transporte|cancelado'], ['criado_em', 'datetime', 'datahora:0:60']]),
        obj(ctx, 'promotions', 'endpoint', 318, [['promocao_id', 'string', 'id:PR-'], ['nome', 'string', 'enum:Semana da Cozinha|Aurora+ 10% off|Leve 3 pague 2'], ['inicio', 'date', 'data:0:20'], ['fim', 'date', 'data:0:5']]),
      ],
      tools: [
        ['var-tl-consultar-produto', 'consultar_produto', 'Detalhes do SKU com preço de lista.', 'leitura'],
        ['var-tl-preco-vigente', 'preco_vigente', 'Preço final com promoções da tabela vigente.', 'leitura'],
      ],
    }),
    connector(ctx, {
      id: 'var-con-oms', typeId: 'oms', name: 'OMS · Orquestração de pedidos', domainId: D.pedido, syncMode: 'cdc',
      volume: 3120000, latencyMs: 180, consumers: [J.anchor, J.prd, 'var-ct-pedido'],
      endpoint: 'https://oms-{env}.auroravarejo.example/v1',
      objects: [
        obj(ctx, 'GET /pedidos', 'endpoint', 3120000, [['pedido_id', 'string', 'id:PED-'], ['cliente', 'string', 'nome'], ['cpf', 'string', 'cpf'], ['canal', 'string', 'enum:e-commerce|app|loja|WhatsApp'], ['nota_fiscal', 'string', 'id:NF-'], ['entregue_em', 'date', 'data:1:120']],
          { row0: { cliente: 'Rafael X*****', cpf: '***.913.058-**' } }),
        obj(ctx, 'GET /reservas', 'endpoint', 61300, [['reserva_id', 'string', 'id:RS-'], ['sku', 'string', 'id:SKU-'], ['loja', 'string', lojas], ['telefone', 'string', 'telefone'], ['expira_em', 'datetime', 'datahora:0:2']]),
      ],
      tools: [
        ['var-tl-consultar-pedido', 'consultar_pedido', 'Pedido com itens, nota fiscal e data de entrega.', 'leitura'],
        ['var-tl-reservar', 'reservar_em_loja', 'Separa o produto na loja por 24 horas em nome do cliente.', 'escrita'],
        ['var-tl-gerar-troca', 'gerar_troca', 'Gera autorização de troca, etiqueta de postagem ou vale.', 'escrita', 'var-pol-troca'],
      ],
    }),
    connector(ctx, {
      id: 'var-con-erp', typeId: 'sap-s4hana', name: 'ERP · SAP S/4HANA', domainId: D.preco, syncMode: 'agendado',
      volume: 920000, latencyMs: 520, consumers: ['var-ct-preco'],
      endpoint: 'https://s4-{env}.auroravarejo.example/sap/opu/odata4',
      objects: [
        obj(ctx, 'A_SalesPrice', 'objeto', 920000, [['sku', 'string', 'id:SKU-'], ['tabela', 'string', 'enum:VIGENTE-2026-10|PROMO-COZINHA'], ['preco', 'decimal', 'valor:79:3499'], ['valido_ate', 'date', 'data:0:30']]),
        obj(ctx, 'A_BillingDocument', 'objeto', 4100000, [['nota_fiscal', 'string', 'id:NF-'], ['pedido_id', 'string', 'id:PED-'], ['valor', 'decimal', 'valor:49:4890'], ['emitida_em', 'date', 'data:0:120']]),
      ],
      tools: [['var-tl-consultar-nf', 'consultar_nota_fiscal', 'Retorna a nota fiscal do pedido.', 'leitura']],
    }),
    connector(ctx, {
      id: 'var-con-pdv', typeId: 'postgresql', name: 'PDV · vendas de loja', domainId: D.loja, syncMode: 'cdc',
      volume: 18400000, latencyMs: 85, consumers: ['var-ct-estoque'],
      endpoint: 'postgresql://pdv-{env}.auroravarejo.example:5432/vendas',
      objects: [
        obj(ctx, 'vendas.cupom', 'tabela', 18400000, [['cupom_id', 'string', 'id:CP-'], ['loja', 'string', lojas], ['valor', 'decimal', 'valor:9:2890'], ['pagamento', 'string', 'enum:crédito|débito|PIX|dinheiro'], ['emitido_em', 'timestamp', 'datahora:0:7']]),
        obj(ctx, 'vendas.item_cupom', 'tabela', 52600000, [['cupom_id', 'string', 'id:CP-'], ['sku', 'string', 'id:SKU-'], ['quantidade', 'integer', 'int:1:4'], ['preco_unitario', 'decimal', 'valor:9:1890']]),
      ],
      tools: [['var-tl-vendas-loja', 'vendas_do_dia', 'Vendas do dia por loja e categoria.', 'leitura']],
    }),
    connector(ctx, {
      id: 'var-con-wms', typeId: 'oracle-db', name: 'WMS · centro de distribuição', status: 'degradado', domainId: D.estoque, syncMode: 'agendado',
      volume: 1260000, latencyMs: 1520, consumers: [J.auto, 'var-ct-estoque'],
      endpoint: 'oracle://wms-{env}.auroravarejo.example:1521/WMSPRD',
      objects: [
        obj(ctx, 'WMS.SALDO_LOJA', 'tabela', 1260000, [['sku', 'string', 'id:SKU-'], ['loja', 'string', lojas], ['saldo', 'integer', 'int:0:60'], ['atualizado_em', 'timestamp', 'datahora:0:1']]),
        obj(ctx, 'WMS.TRANSFERENCIA', 'tabela', 340000, [['transferencia_id', 'string', 'id:TR-'], ['sku', 'string', 'id:SKU-'], ['destino', 'string', lojas], ['quantidade', 'integer', 'int:2:40'], ['status', 'string', 'enum:criada|em trânsito|recebida']]),
      ],
      tools: [
        ['var-tl-estoque-loja', 'estoque_por_loja', 'Saldo do SKU nas lojas próximas.', 'leitura'],
        ['var-tl-transferencia', 'criar_transferencia', 'Cria transferência do CD para a loja.', 'escrita'],
      ],
    }),
    connector(ctx, {
      id: 'var-con-fidelidade', typeId: 'rest-openapi', name: 'Fidelidade Aurora+ · API', domainId: D.cliente, syncMode: 'sob_demanda',
      volume: 1120000, latencyMs: 160, consumers: [J.prd, 'var-ct-cliente'],
      endpoint: 'https://fidelidade-{env}.auroravarejo.example/api/v3',
      objects: [
        obj(ctx, 'GET /membros', 'endpoint', 1120000, [['membro_id', 'string', 'id:AU-'], ['nome', 'string', 'nome'], ['telefone', 'string', 'telefone'], ['nivel', 'string', 'enum:Aurora+|Aurora+ Ouro'], ['pontos', 'integer', 'int:0:42000']]),
        obj(ctx, 'GET /resgates', 'endpoint', 2210000, [['resgate_id', 'string', 'id:RG-'], ['membro_id', 'string', 'id:AU-'], ['pontos', 'integer', 'int:500:20000'], ['resgatado_em', 'date', 'data:0:90']]),
      ],
      tools: [['var-tl-saldo-pontos', 'saldo_de_pontos', 'Saldo e nível do cliente no Aurora+.', 'leitura']],
    }),
  ];

  const channels: Channel[] = [
    { id: 'var-ch-whatsapp', type: 'whatsapp', name: 'WhatsApp Aurora', status: 'ativo', config: { numero: '+55 11 4000-0202', templates: 'reserva_confirmada, troca_aprovada', optin: 'obrigatório', horario: '8h às 22h' }, journeyByEnv: {} },
    { id: 'var-ch-app', type: 'app', name: 'App Aurora', status: 'ativo', config: { sdk: 'cortex-sdk 2.4', area: 'Meus pedidos → Trocar' }, journeyByEnv: { dev: J.prd, hml: J.prd, prd: J.prd } },
    { id: 'var-ch-ecommerce', type: 'webchat', name: 'Chat do e-commerce', status: 'ativo', config: { cor: '#A07EFC', boasVindas: 'Oi! Posso ajudar com seu pedido?', horario: '24 horas' }, journeyByEnv: { dev: J.prd, hml: J.prd, prd: J.prd } },
    { id: 'var-ch-pdv', type: 'api', name: 'PDV (API de loja)', status: 'ativo', config: { endpoint: '/jornadas/troca-balcao', autenticacao: 'mTLS por loja' }, journeyByEnv: { prd: J.prd } },
    { id: 'var-ch-backoffice', type: 'backoffice', name: 'Backoffice de loja', status: 'ativo', config: { fila: 'Gerentes de loja', alertas: 'reposição e reservas' }, journeyByEnv: { dev: J.auto, hml: J.auto } },
  ];

  const systems: EcosystemSystem[] = [
    { id: 'var-sys-crm', name: 'CRM/CDP', category: 'crm' },
    { id: 'var-sys-ecommerce', name: 'E-commerce', category: 'setorial', connectorId: 'var-con-vtex' },
    { id: 'var-sys-oms', name: 'OMS', category: 'setorial', connectorId: 'var-con-oms' },
    { id: 'var-sys-erp', name: 'ERP', category: 'erp', connectorId: 'var-con-erp' },
    { id: 'var-sys-pdv', name: 'PDV', category: 'banco', connectorId: 'var-con-pdv' },
    { id: 'var-sys-wms', name: 'WMS', category: 'banco', connectorId: 'var-con-wms' },
    { id: 'var-sys-fidelidade', name: 'Fidelidade Aurora+', category: 'api', connectorId: 'var-con-fidelidade' },
    { id: 'var-sys-whatsapp', name: 'WhatsApp', category: 'canal' },
    { id: 'var-sys-app', name: 'App Aurora', category: 'canal' },
    { id: 'var-sys-loja', name: 'Backoffice de loja', category: 'canal' },
  ];

  const domains: DataDomain[] = [
    { id: D.cliente, name: 'Cliente', kind: 'negocio', owner: u('dono_negocio'), description: 'Clientes, programa Aurora+, consentimentos e preferências.', entities: ['Cliente', 'Membro Aurora+', 'Consentimento'], relations: [D.pedido, D.loja], products: ['var-tb-our-cliente'], consumers: [J.prd], position: { x: 0, y: 0 } },
    { id: D.produto, name: 'Produto', kind: 'negocio', owner: u('dono_negocio'), description: 'Catálogo, categorias, atributos e garantias.', entities: ['Produto', 'SKU', 'Categoria'], relations: [D.estoque, D.preco, D.pedido], products: [], consumers: [J.anchor], position: { x: 300, y: 0 } },
    { id: D.estoque, name: 'Estoque', kind: 'negocio', owner: u('champion'), description: 'Saldo por loja e CD, transferências e ruptura.', entities: ['Saldo', 'Transferência'], relations: [D.produto, D.loja], products: ['var-tb-our-estoque'], consumers: [J.anchor, J.auto], position: { x: 600, y: 0 } },
    { id: D.pedido, name: 'Pedido', kind: 'negocio', owner: u('dono_negocio'), description: 'Pedidos omnichannel, reservas, notas fiscais, trocas e devoluções.', entities: ['Pedido', 'Reserva', 'Troca'], relations: [D.cliente, D.produto, D.loja], products: ['var-tb-our-trocas'], consumers: [J.anchor, J.prd], position: { x: 0, y: 240 } },
    { id: D.preco, name: 'Preço e promoção', kind: 'negocio', owner: u('dono_negocio'), description: 'Tabela vigente, campanhas e regras de promoção.', entities: ['Preço', 'Promoção'], relations: [D.produto], products: [], consumers: [J.anchor], position: { x: 300, y: 240 } },
    { id: D.loja, name: 'Loja', kind: 'negocio', owner: u('champion'), description: 'Lojas físicas, horários e capacidade de retirada.', entities: ['Loja', 'Ponto de retirada'], relations: [D.estoque, D.pedido, D.cliente], products: [], consumers: [J.auto], position: { x: 600, y: 240 } },
    { id: D.eventos, name: 'Eventos', kind: 'tecnico', owner: u('engenheiro_dados'), description: 'Eventos de pedido, estoque e PDV em tempo real.', entities: ['Evento de pedido', 'Evento de estoque'], relations: [D.pedido, D.estoque], products: [], consumers: [], position: { x: 900, y: 80 } },
    { id: D.logs, name: 'Logs', kind: 'tecnico', owner: u('engenheiro_dados'), description: 'Traces das jornadas, auditoria e telemetria do Claude Code.', entities: ['Trace', 'Evento de auditoria'], relations: [D.eventos], products: [], consumers: [], position: { x: 900, y: 360 } },
  ];

  const contracts = [
    contract(ctx, {
      id: 'var-ct-cliente', name: 'Contrato Cliente', domainId: D.cliente, entity: 'Cliente', owner: u('engenheiro_dados'),
      fields: [
        ['cliente_id', 'string', true, 'interno', 'Identificador único do cliente (CDP).'],
        ['nome', 'string', true, 'pii', 'Nome do cliente.'],
        ['cpf', 'string', true, 'pii', 'CPF.'],
        ['email', 'string', false, 'pii', 'E-mail.'],
        ['telefone', 'string', true, 'pii', 'Celular (WhatsApp).'],
        ['segmento_fidelidade', 'string', true, 'interno', 'Nível no Aurora+; define prazos estendidos de troca.'],
        ['loja_preferida', 'string', false, 'interno', 'Loja mais frequente.'],
        ['consentimento_whatsapp', 'boolean', false, 'interno', 'Opt-in para WhatsApp.'],
      ],
      addedInV2: ['loja_preferida', 'consentimento_whatsapp'],
      removedInV2: [['data_nascimento', 'date', false, 'pii', 'Removido por minimização de dados.']],
      v2Note: 'Cliente v2: inclui loja preferida e consentimento de WhatsApp; remove data de nascimento.',
      freshness: '1h', expectedVolume: '1,8 milhão de clientes',
    }),
    contract(ctx, {
      id: 'var-ct-produto', name: 'Contrato Produto', domainId: D.produto, entity: 'Produto', owner: u('engenheiro_dados'),
      fields: [
        ['sku', 'string', true, 'publico', 'Código do SKU.'],
        ['nome', 'string', true, 'publico', 'Nome comercial.'],
        ['categoria', 'string', true, 'publico', 'Categoria.'],
        ['duravel', 'boolean', true, 'publico', 'Produto durável (afeta prazo de reclamação por defeito).'],
        ['garantia_meses', 'integer', false, 'publico', 'Garantia do fabricante.'],
      ],
      addedInV2: ['garantia_meses'], v2Note: 'Inclui garantia do fabricante.',
      freshness: '6h', expectedVolume: '84 mil SKUs ativos',
    }),
    contract(ctx, {
      id: 'var-ct-estoque', name: 'Contrato Estoque por loja', domainId: D.estoque, entity: 'Saldo', owner: u('engenheiro_dados'),
      fields: [
        ['sku', 'string', true, 'publico', 'SKU.', 'Produto.sku'],
        ['loja_id', 'string', true, 'publico', 'Loja.'],
        ['saldo', 'integer', true, 'interno', 'Unidades disponíveis.'],
        ['reservado', 'integer', true, 'interno', 'Unidades reservadas para retirada.'],
        ['cobertura_dias', 'decimal', false, 'interno', 'Dias de venda cobertos pelo saldo.'],
      ],
      addedInV2: ['cobertura_dias'], v2Note: 'Inclui cobertura em dias para reposição.',
      freshness: '4h', expectedVolume: '1,2 milhão de pares SKU-loja', failing: true,
    }),
    contract(ctx, {
      id: 'var-ct-pedido', name: 'Contrato Pedido', domainId: D.pedido, entity: 'Pedido', owner: u('engenheiro_dados'),
      fields: [
        ['pedido_id', 'string', true, 'interno', 'Identificador.'],
        ['cliente_id', 'string', true, 'interno', 'Cliente.', 'Cliente.cliente_id'],
        ['canal', 'string', true, 'interno', 'e-commerce, app, loja ou WhatsApp.'],
        ['nota_fiscal', 'string', true, 'interno', 'Número da NF-e.'],
        ['entregue_em', 'date', false, 'interno', 'Data de entrega ou retirada.'],
        ['itens', 'array', true, 'interno', 'Itens com SKU e quantidade.'],
      ],
      addedInV2: ['entregue_em'], v2Note: 'Inclui data de entrega para cálculo de prazo de troca.',
      freshness: '15min', expectedVolume: '25 mil pedidos por dia', faixa: ['itens', 'size(itens) >= 1'],
    }),
    contract(ctx, {
      id: 'var-ct-preco', name: 'Contrato Preço vigente', domainId: D.preco, entity: 'Preço', owner: u('dono_negocio'),
      fields: [
        ['sku', 'string', true, 'publico', 'SKU.', 'Produto.sku'],
        ['preco_lista', 'decimal', true, 'publico', 'Preço de tabela.'],
        ['preco_promocional', 'decimal', false, 'publico', 'Preço da campanha ativa.'],
        ['campanha_id', 'string', false, 'interno', 'Campanha de origem.'],
        ['valido_ate', 'date', true, 'interno', 'Fim da vigência.'],
      ],
      addedInV2: ['campanha_id'], v2Note: 'Liga o preço à campanha de origem.',
      freshness: '1h', expectedVolume: '84 mil preços', faixa: ['preco_lista', 'preco_lista > 0'],
    }),
    contract(ctx, {
      id: 'var-ct-loja', name: 'Contrato Loja', domainId: D.loja, entity: 'Loja', owner: u('engenheiro_dados'),
      fields: [
        ['loja_id', 'string', true, 'publico', 'Identificador.'],
        ['nome', 'string', true, 'publico', 'Nome da loja.'],
        ['cidade', 'string', true, 'publico', 'Cidade.'],
        ['horario', 'string', true, 'publico', 'Horário de funcionamento.'],
        ['retirada_ativa', 'boolean', true, 'publico', 'Aceita retirada de reservas.'],
      ],
      addedInV2: ['retirada_ativa'], v2Note: 'Inclui indicador de retirada.', versions: ['1.0.0', '1.1.0'],
      freshness: '24h', expectedVolume: '86 lojas',
    }),
  ];

  const tables = [
    table(ctx, 'var-tb-brz-pedidos', 'brz_oms_pedidos', 'bronze', D.pedido, 3120000, [['pedido_id', 'string', 'id:PED-'], ['cliente', 'string', 'nome'], ['cpf', 'string', 'cpf'], ['payload_canal', 'string', 'enum:ECOM|APP|LOJA|WPP'], ['recebido_em', 'timestamp', 'datahora:0:1']], 1),
    table(ctx, 'var-tb-brz-saldo', 'brz_wms_saldo_loja', 'bronze', D.estoque, 1260000, [['sku', 'string', 'id:SKU-'], ['loja', 'string', 'enum:L001|L014|L022|L031'], ['saldo', 'string', 'int:0:60'], ['extraido_em', 'timestamp', 'datahora:0:1']], 4),
    table(ctx, 'var-tb-brz-membros', 'brz_fidelidade_membros', 'bronze', D.cliente, 1120000, [['membro_id', 'string', 'id:AU-'], ['nome', 'string', 'nome'], ['telefone', 'string', 'telefone'], ['nivel', 'string', 'enum:AURORA_PLUS|AURORA_OURO']], 2),
    table(ctx, 'var-tb-prt-pedidos', 'prt_pedidos', 'prata', D.pedido, 3118000, [['pedido_id', 'string', 'id:PED-'], ['cliente_id', 'string', 'id:CLI-'], ['canal', 'string', 'enum:e-commerce|app|loja|WhatsApp'], ['valor', 'decimal', 'valor:49:4890'], ['entregue_em', 'date', 'data:1:120']], 2),
    table(ctx, 'var-tb-prt-saldo', 'prt_saldo_loja', 'prata', D.estoque, 1259000, [['sku', 'string', 'id:SKU-'], ['loja_id', 'string', 'enum:L001|L014|L022|L031'], ['saldo', 'integer', 'int:0:60'], ['reservado', 'integer', 'int:0:4']], 4),
    table(ctx, 'var-tb-prt-clientes', 'prt_clientes', 'prata', D.cliente, 1838000, [['cliente_id', 'string', 'id:CLI-'], ['nome_hash', 'string', 'hash'], ['cpf_hash', 'string', 'hash'], ['segmento_fidelidade', 'string', 'enum:Aurora+|Aurora+ Ouro|Sem programa'], ['uf', 'string', 'uf']], 2),
    table(ctx, 'var-tb-our-cliente', 'our_cliente_360', 'ouro', D.cliente, 1838000, [['cliente_id', 'string', 'id:CLI-'], ['segmento_fidelidade', 'string', 'enum:Aurora+|Aurora+ Ouro|Sem programa'], ['loja_preferida', 'string', 'enum:Shopping Paulista|Campinas Centro|Barra'], ['compras_12m', 'integer', 'int:1:38'], ['ticket_medio', 'decimal', 'valor:60:900']], 3),
    table(ctx, 'var-tb-our-estoque', 'our_estoque_loja', 'ouro', D.estoque, 1259000, [['sku', 'string', 'id:SKU-'], ['loja', 'string', lojas], ['disponivel', 'integer', 'int:0:56'], ['cobertura_dias', 'decimal', 'pct:0:20'], ['ruptura', 'boolean', 'bool:0.06']], 4),
    table(ctx, 'var-tb-our-trocas', 'our_trocas_devolucoes', 'ouro', D.pedido, 48200, [['troca_id', 'string', 'id:TC-'], ['motivo', 'string', 'enum:defeito|arrependimento|tamanho_cor'], ['canal', 'string', 'enum:app|loja|e-commerce'], ['dias_ate_solucao', 'decimal', 'pct:1:12'], ['aprovada', 'boolean', 'bool:0.86']], 3),
  ];

  const sqlExamples = [
    { id: 'var-sql-1', question: 'Qual o tempo médio de troca por motivo no último mês?', sql: "SELECT motivo, round(avg(dias_ate_solucao), 1) AS dias_medios, count(*) AS trocas\nFROM our_trocas_devolucoes\nGROUP BY motivo\nORDER BY dias_medios DESC;", columns: ['motivo', 'dias_medios', 'trocas'], rows: [['defeito', 5.8, 2140], ['tamanho_cor', 3.9, 1820], ['arrependimento', 3.1, 960]] },
    { id: 'var-sql-2', question: 'Quais lojas têm mais SKUs em ruptura hoje?', sql: 'SELECT loja, count(*) AS skus_em_ruptura\nFROM our_estoque_loja\nWHERE ruptura = true\nGROUP BY loja\nORDER BY skus_em_ruptura DESC\nLIMIT 3;', columns: ['loja', 'skus_em_ruptura'], rows: [['Barra', 1284], ['Campinas Centro', 1102], ['Shopping Paulista', 876]] },
    { id: 'var-sql-3', question: 'Quantos clientes Aurora+ Ouro compraram mais de 10 vezes no ano?', sql: "SELECT count(*) AS clientes\nFROM our_cliente_360\nWHERE segmento_fidelidade = 'Aurora+ Ouro'\n  AND compras_12m > 10;", columns: ['clientes'], rows: [[38410]] },
  ];

  const collections = [
    { id: 'var-col-politicas', name: 'Políticas comerciais', theme: 'Políticas', owner: u('dono_negocio'), domainId: D.pedido, profiles: ['dono_negocio', 'champion', 'engenheiro_ai'], chunking: 'Por seção, até 400 tokens', embeddingModel: 'multilingual-e5-large' },
    { id: 'var-col-consumidor', name: 'Direito do consumidor (guias internos)', theme: 'Regulamentação', owner: u('seguranca'), profiles: ['dono_negocio', 'champion', 'coe', 'seguranca'], chunking: 'Por tema, até 300 tokens', embeddingModel: 'multilingual-e5-large' },
    { id: 'var-col-promocoes', name: 'Regras de promoção', theme: 'Políticas', owner: u('dono_negocio'), domainId: D.preco, profiles: ['dono_negocio', 'champion'], chunking: 'Por campanha', embeddingModel: 'multilingual-e5-large' },
    { id: 'var-col-lojas', name: 'Manuais de loja', theme: 'Manuais', owner: u('champion'), domainId: D.loja, profiles: ['champion', 'engenheiro_ai', 'dono_negocio'], chunking: 'Por procedimento', embeddingModel: 'multilingual-e5-large' },
  ] as IndustryContent['collections'];

  const documents: IndustryContent['documents'] = [
    { id: 'var-doc-trocas', collectionId: 'var-col-politicas', title: 'Política de trocas v3', version: '3.0', updatedAt: dateAgo(26), status: 'processado', chunks: [
      'Esta política vale para compras na loja física, no e-commerce, no app e pelo WhatsApp da Aurora Varejo.',
      'Produto com defeito: o cliente pode pedir a troca em até 30 dias para itens não duráveis e em até 90 dias para itens duráveis, contados da entrega. A Aurora resolve com troca imediata ou reembolso em até 10 dias.',
      'Arrependimento em compras online: devolução em até 7 dias corridos após a entrega, com reembolso integral, inclusive do frete.',
      'Troca por tamanho ou cor: em até 30 dias, com etiqueta e sem sinais de uso, em qualquer loja ou pelo app.',
      'Clientes Aurora+ Ouro têm prazo estendido de 45 dias para troca por tamanho ou cor.',
    ] },
    { id: 'var-doc-cdc', collectionId: 'var-col-consumidor', title: 'Guia interno de direitos do consumidor no varejo', version: '2.2', updatedAt: dateAgo(70), status: 'processado', chunks: [
      'Este guia resume, em linguagem simples, os compromissos da Aurora com o consumidor. Não substitui a legislação.',
      'O preço anunciado é o preço cobrado: divergências entre gôndola, site e caixa são resolvidas pelo menor preço.',
      'Compras feitas fora da loja física contam com direito de arrependimento.',
      'Produtos com defeito devem ter solução rápida; não pedimos ao cliente que procure o fabricante antes de nós.',
    ] },
    { id: 'var-doc-promocoes', collectionId: 'var-col-promocoes', title: 'Regras de promoção · outubro de 2026', version: '2026.10', updatedAt: dateAgo(9), status: 'processado', chunks: [
      'Semana da Cozinha: até 25% de desconto em eletroportáteis selecionados, de 15 a 26 de outubro.',
      'Aurora+ 10% off: desconto adicional para membros, não cumulativo com Leve 3 pague 2.',
      'O agente só informa preço e promoção da tabela vigente no ERP; preços de campanhas encerradas não podem ser oferecidos.',
    ] },
    { id: 'var-doc-reserva', collectionId: 'var-col-lojas', title: 'Manual de loja: reserva e retirada', version: '1.5', updatedAt: dateAgo(40), status: 'processado', chunks: [
      'A reserva separa o produto por 24 horas a partir da confirmação; depois disso, o item volta para a venda.',
      'Na retirada, peça documento com foto e o código da reserva enviado ao cliente.',
      'Reservas são permitidas para até 3 unidades por SKU e por cliente.',
      'Se o produto estiver em ruptura na loja escolhida, ofereça a loja mais próxima com saldo.',
    ] },
    { id: 'var-doc-garantias', collectionId: 'var-col-politicas', title: 'Guia de categorias e garantias', version: '1.2', updatedAt: dateAgo(55), status: 'processando', chunks: [
      'Eletroportáteis e eletrônicos são itens duráveis; roupas, cosméticos e alimentos são não duráveis.',
      'A garantia do fabricante complementa, e não substitui, a política de trocas da Aurora.',
      'Garantia estendida Aurora pode ser contratada em até 30 dias após a compra.',
    ] },
  ];

  const retrievals = [
    { question: DEMO.showcaseQuestion, answer: 'Até 30 dias para produtos não duráveis e até 90 dias para produtos duráveis, contados da entrega. A Aurora resolve com troca imediata ou reembolso em até 10 dias.', results: [{ docId: 'var-doc-trocas', chunkIndex: 1, score: 0.95 }, { docId: 'var-doc-garantias', chunkIndex: 0, score: 0.78 }, { docId: 'var-doc-cdc', chunkIndex: 3, score: 0.69 }] },
    { question: 'posso devolver um produto comprado no site se me arrependi?', answer: 'Sim, em até 7 dias corridos após a entrega, com reembolso integral, inclusive do frete.', results: [{ docId: 'var-doc-trocas', chunkIndex: 2, score: 0.93 }, { docId: 'var-doc-cdc', chunkIndex: 2, score: 0.8 }] },
    { question: 'por quanto tempo a reserva fica separada na loja?', answer: 'Por 24 horas a partir da confirmação; depois disso, o item volta para a venda.', results: [{ docId: 'var-doc-reserva', chunkIndex: 0, score: 0.96 }, { docId: 'var-doc-reserva', chunkIndex: 1, score: 0.7 }] },
  ];

  const knowledgeGraph: IndustryContent['knowledgeGraph'] = {
    nodes: [
      { id: 'var-kg-cliente', label: 'Cliente', kind: 'entidade' },
      { id: 'var-kg-produto', label: 'Produto', kind: 'entidade' },
      { id: 'var-kg-pedido', label: 'Pedido', kind: 'entidade' },
      { id: 'var-kg-troca', label: 'Troca', kind: 'entidade' },
      { id: 'var-kg-promocao', label: 'Promoção', kind: 'entidade' },
      { id: 'var-tb-our-cliente', label: 'our_cliente_360', kind: 'tabela' },
      { id: 'var-tb-our-estoque', label: 'our_estoque_loja', kind: 'tabela' },
      { id: 'var-tb-our-trocas', label: 'our_trocas_devolucoes', kind: 'tabela' },
      { id: 'var-doc-trocas', label: 'Política de trocas v3', kind: 'documento' },
      { id: 'var-doc-promocoes', label: 'Regras de promoção', kind: 'documento' },
      { id: 'var-doc-reserva', label: 'Manual de reserva e retirada', kind: 'documento' },
      { id: 'var-dt-troca', label: 'Troca e devolução', kind: 'regra' },
      { id: 'var-dt-promocao', label: 'Preço e promoção vigente', kind: 'regra' },
    ],
    edges: [
      { source: 'var-kg-cliente', target: 'var-kg-pedido', label: 'faz' },
      { source: 'var-kg-pedido', target: 'var-kg-produto', label: 'contém' },
      { source: 'var-kg-pedido', target: 'var-kg-troca', label: 'pode gerar' },
      { source: 'var-kg-troca', target: 'var-dt-troca', label: 'decidida por' },
      { source: 'var-dt-troca', target: 'var-doc-trocas', label: 'origem' },
      { source: 'var-kg-troca', target: 'var-tb-our-trocas', label: 'publicada em' },
      { source: 'var-kg-produto', target: 'var-tb-our-estoque', label: 'saldo em' },
      { source: 'var-kg-produto', target: 'var-kg-promocao', label: 'participa de' },
      { source: 'var-kg-promocao', target: 'var-dt-promocao', label: 'aplicada por' },
      { source: 'var-dt-promocao', target: 'var-doc-promocoes', label: 'origem' },
      { source: 'var-kg-cliente', target: 'var-tb-our-cliente', label: 'publicada em' },
      { source: 'var-kg-pedido', target: 'var-doc-reserva', label: 'procedimento' },
    ],
  };

  const artifacts: IndustryContent['artifacts'] = [
    { id: 'var-art-okr-conv', areaId: 'area-empresa', kind: 'OKR', title: 'Elevar a conversão digital para 3,2%', summary: 'Conversão de visitas em pedidos no e-commerce, app e WhatsApp.', tags: ['okr', 'conversão'], metrics: [{ label: 'Atual', value: '2,9%' }, { label: 'Meta', value: '3,2%' }] },
    { id: 'var-art-okr-ruptura', areaId: 'area-empresa', kind: 'OKR', title: 'Reduzir a ruptura nas lojas para 4%', summary: 'SKUs sem saldo na loja com demanda no dia.', tags: ['okr', 'estoque'], metrics: [{ label: 'Atual', value: '5,6%' }, { label: 'Meta', value: '4%' }] },
    { id: 'var-art-proc-omni', areaId: 'area-empresa', kind: 'Processo', title: 'Pedido omnichannel', summary: 'Compra em qualquer canal → reserva ou entrega → retirada → pós-venda.', tags: ['processo', 'omnichannel'] },
    { id: 'var-art-mkt-bench', areaId: 'area-mercado', kind: 'Ficha de mercado', title: 'Benchmark de compra com retirada em loja', summary: 'Varejistas líderes oferecem reserva em loja com retirada em 2 horas; 30% das vendas digitais já terminam na loja.', body: 'Fonte: pesquisa setorial fictícia para a demo, setembro de 2026.', tags: ['benchmark', 'retirada'], metrics: [{ label: 'Fonte', value: 'Pesquisa setorial' }, { label: 'Data', value: 'set/2026' }] },
    { id: 'var-art-mkt-reg', areaId: 'area-mercado', kind: 'Ficha de regulação', title: 'Direito de arrependimento e defeito', summary: 'Prazos de arrependimento em compras a distância e de reclamação por defeito orientam a política de trocas.', body: 'Fonte: Guia interno de direitos do consumidor no varejo, revisão 2.2. Origina a regra "Troca e devolução".', tags: ['regulação', 'troca'], metrics: [{ label: 'Fonte', value: 'Guia interno 2.2' }, { label: 'Data', value: 'ago/2026' }] },
    { id: 'var-art-mkt-whats', areaId: 'area-mercado', kind: 'Ficha de mercado', title: 'Vendas conversacionais', summary: 'Concorrentes vendem até 8% do digital pelo WhatsApp, com ticket 12% maior.', tags: ['whatsapp', 'vendas'], metrics: [{ label: 'Fonte', value: 'Levantamento comercial' }, { label: 'Data', value: 'out/2026' }] },
    { id: 'var-art-jor-compra', areaId: 'area-jornadas', kind: 'Mapa de jornada', title: 'Compra com retirada em loja', summary: 'Etapas: descoberta → dúvida → reserva → retirada. Dor: produto anunciado sem saldo na loja.', tags: ['jornada', 'compra'], metrics: [{ label: 'KPI', value: 'Conversão' }, { label: 'Canais', value: 'WhatsApp, App, Loja' }] },
    { id: 'var-art-jor-troca', areaId: 'area-jornadas', kind: 'Mapa de jornada', title: 'Troca e devolução', summary: 'Etapas: problema → pedido de troca → análise → postagem ou loja → solução. Dor: prazo de 9 dias.', tags: ['jornada', 'troca'], metrics: [{ label: 'KPI', value: 'Tempo de troca' }] },
    { id: 'var-art-jor-gerente', areaId: 'area-jornadas', kind: 'Mapa de jornada', title: 'Rotina do gerente de loja', summary: 'Colaborador: abertura → conferência de estoque → reposição → fechamento. Dor: ruptura descoberta tarde.', tags: ['jornada', 'colaborador'] },
    { id: 'var-art-prd-aurora-plus', areaId: 'area-produtos', kind: 'Produto', title: 'Programa Aurora+', summary: 'Fidelidade com pontos, 10% off em campanhas e prazo de troca estendido no nível Ouro.', tags: ['fidelidade'], metrics: [{ label: 'Membros', value: '1,1 milhão' }] },
    { id: 'var-art-prd-garantia', areaId: 'area-produtos', kind: 'Produto', title: 'Garantia estendida Aurora', summary: '12 ou 24 meses adicionais para eletroportáteis e eletrônicos.', tags: ['serviço', 'garantia'] },
    { id: 'var-art-prd-retirada', areaId: 'area-produtos', kind: 'Produto', title: 'Retire em 2 horas', summary: 'Reserva gratuita em 86 lojas, com retirada no mesmo dia.', tags: ['omnichannel'] },
    { id: 'var-art-reg-troca', areaId: 'area-regras', kind: 'Tabela de decisão', title: 'Troca e devolução', summary: 'Decisão e prazo por motivo, canal de compra, dias desde a entrega e uso do produto.', tags: ['regra', 'troca'], componentId: 'var-cp-rule-troca' },
    { id: 'var-art-reg-preco', areaId: 'area-regras', kind: 'Guardrail', title: 'Preço e promoção só da tabela vigente', summary: 'Agentes só citam preços da tabela vigente do ERP e campanhas ativas.', tags: ['guardrail', 'preço'], componentId: 'var-cp-rule-preco' },
    { id: 'var-art-reg-estoque', areaId: 'area-regras', kind: 'Tabela de decisão', title: 'Estoque mínimo por loja', summary: 'Ação de reposição pela cobertura em dias.', tags: ['regra', 'estoque'] },
  ];

  const decisionTables: DecisionTable[] = [
    {
      id: 'var-dt-troca', name: 'Troca e devolução', domainId: D.pedido, version: '3.0.0', componentId: 'var-cp-rule-troca',
      description: 'Define a solução e o prazo de uma troca ou devolução a partir do motivo, do canal de compra e do tempo desde a entrega.',
      source: 'Política de trocas v3 e Guia interno de direitos do consumidor',
      inputs: [
        { key: 'motivo', label: 'Motivo', type: 'enum', options: ['defeito', 'arrependimento', 'tamanho_cor'] },
        { key: 'canal_compra', label: 'Canal da compra', type: 'enum', options: ['online', 'loja'] },
        { key: 'dias_desde_entrega', label: 'Dias desde a entrega', type: 'number' },
        { key: 'duravel', label: 'Produto durável', type: 'boolean' },
      ],
      outputs: [{ key: 'decisao', label: 'Decisão' }, { key: 'prazo_solucao', label: 'Prazo de solução' }],
      rows: [
        { id: 'r1', conditions: { motivo: '=arrependimento', canal_compra: '=online', dias_desde_entrega: '<=7', duravel: '*' }, outputs: { decisao: 'Devolução com reembolso integral, inclusive frete', prazo_solucao: '10 dias' } },
        { id: 'r2', conditions: { motivo: '=arrependimento', canal_compra: '=online', dias_desde_entrega: '>7', duravel: '*' }, outputs: { decisao: 'Fora do prazo; oferecer vale-troca de cortesia', prazo_solucao: '—' } },
        { id: 'r3', conditions: { motivo: '=arrependimento', canal_compra: '=loja', dias_desde_entrega: '<=30', duravel: '*' }, outputs: { decisao: 'Troca por cortesia, com etiqueta', prazo_solucao: 'Imediato na loja' } },
        { id: 'r4', conditions: { motivo: '=defeito', canal_compra: '*', dias_desde_entrega: '<=90', duravel: '=true' }, outputs: { decisao: 'Troca imediata ou reembolso', prazo_solucao: '10 dias' } },
        { id: 'r5', conditions: { motivo: '=defeito', canal_compra: '*', dias_desde_entrega: '<=30', duravel: '=false' }, outputs: { decisao: 'Troca imediata ou reembolso', prazo_solucao: '10 dias' } },
        { id: 'r6', conditions: { motivo: '=defeito', canal_compra: '*', dias_desde_entrega: '>90', duravel: '=true' }, outputs: { decisao: 'Encaminhar à garantia do fabricante com apoio da Aurora', prazo_solucao: '30 dias' } },
        { id: 'r7', conditions: { motivo: '=tamanho_cor', canal_compra: '*', dias_desde_entrega: '<=30', duravel: '*' }, outputs: { decisao: 'Troca por outro tamanho ou cor', prazo_solucao: 'Imediato' } },
      ],
      sampleCase: { motivo: 'defeito', canal_compra: 'online', dias_desde_entrega: 12, duravel: true },
    },
    {
      id: 'var-dt-promocao', name: 'Preço e promoção vigente', domainId: D.preco, version: '1.1.0', componentId: 'var-cp-rule-preco',
      description: 'Escolhe o preço que o agente pode informar, considerando campanha ativa e fidelidade.',
      source: 'Regras de promoção · outubro de 2026',
      inputs: [
        { key: 'campanha_ativa', label: 'Campanha ativa no SKU', type: 'boolean' },
        { key: 'membro_aurora', label: 'Membro Aurora+', type: 'boolean' },
        { key: 'leve3pague2', label: 'Compra no Leve 3 pague 2', type: 'boolean' },
      ],
      outputs: [{ key: 'preco', label: 'Preço aplicado' }],
      rows: [
        { id: 'r1', conditions: { campanha_ativa: '=false', membro_aurora: '=false', leve3pague2: '*' }, outputs: { preco: 'Preço de lista' } },
        { id: 'r2', conditions: { campanha_ativa: '=true', membro_aurora: '=false', leve3pague2: '*' }, outputs: { preco: 'Preço da campanha' } },
        { id: 'r3', conditions: { campanha_ativa: '*', membro_aurora: '=true', leve3pague2: '=false' }, outputs: { preco: 'Preço vigente com 10% Aurora+' } },
        { id: 'r4', conditions: { campanha_ativa: '*', membro_aurora: '=true', leve3pague2: '=true' }, outputs: { preco: 'Leve 3 pague 2, sem desconto adicional' } },
      ],
      sampleCase: { campanha_ativa: true, membro_aurora: true, leve3pague2: false },
    },
    {
      id: 'var-dt-estoque-min', name: 'Estoque mínimo por loja', domainId: D.estoque, version: '1.0.0',
      description: 'Ação de reposição a partir da cobertura em dias.', source: 'Política de abastecimento de lojas',
      inputs: [{ key: 'cobertura_dias', label: 'Cobertura (dias)', type: 'number' }, { key: 'curva', label: 'Curva ABC', type: 'enum', options: ['A', 'B', 'C'] }],
      outputs: [{ key: 'acao', label: 'Ação' }],
      rows: [
        { id: 'r1', conditions: { cobertura_dias: '<3', curva: 'A|B' }, outputs: { acao: 'Repor com urgência (transferência hoje)' } },
        { id: 'r2', conditions: { cobertura_dias: '<3', curva: '=C' }, outputs: { acao: 'Repor no próximo ciclo' } },
        { id: 'r3', conditions: { cobertura_dias: '3..7', curva: '*' }, outputs: { acao: 'Repor no próximo ciclo' } },
        { id: 'r4', conditions: { cobertura_dias: '>7', curva: '*' }, outputs: { acao: 'Não repor' } },
      ],
      sampleCase: { cobertura_dias: 2.5, curva: 'A' },
    },
  ];

  const components: IndustryContent['components'] = [
    { id: 'var-cp-agent-compra', type: 'agent', name: 'Assistente de compra', version: '1.2.0', status: 'publicado_prd', domainId: D.produto, owner: 'champion',
      description: 'Ajuda o cliente a encontrar o produto, confirma saldo na loja e reserva para retirada.',
      content: 'Papel: vendedor digital da Aurora.\nRegras: Preço e promoção só da tabela vigente; Responder somente com fonte homologada.\nSkills: Consultar estoque por loja.\nTools: consultar_produto, preco_vigente, estoque_por_loja, reservar_em_loja.',
      inputs: ['mensagem do cliente', 'catálogo', 'estoque'], outputs: ['recomendação', 'reserva'], dependencies: ['var-cp-rule-preco', 'var-cp-skill-estoque', 'var-cp-rule-fonte'] },
    { id: 'var-cp-agent-trocas', type: 'agent', name: 'Agente de trocas e devoluções', version: '2.0.0', status: 'publicado_prd', domainId: D.pedido, owner: 'champion',
      description: 'Conduz trocas e devoluções seguindo a política vigente e gera etiqueta ou vale.',
      content: 'Papel: atendente de pós-venda.\nRegras: Regra de troca e devolução.\nDocumento: Política de trocas v3.\nNunca promete prazo diferente do que a regra retornou.',
      inputs: ['pedido de troca', 'pedido e nota fiscal', 'decisão da regra'], outputs: ['autorização de troca'], dependencies: ['var-cp-rule-troca', 'var-cp-doc-trocas'],
      log: [['1.0.0', 150, 'Versão inicial.'], ['2.0.0', 40, 'Usa a Política de trocas v3.']] },
    { id: 'var-cp-rule-troca', type: 'rule', name: 'Regra de troca e devolução', version: '3.0.0', status: 'publicado_prd', domainId: D.pedido, owner: 'dono_negocio',
      description: 'Tabela de decisão "Troca e devolução" publicada como componente Rule.',
      content: 'Fonte: tabela "Troca e devolução" v3.0.0 (7 linhas).\nSaídas: decisao, prazo_solucao.', inputs: ['motivo', 'canal_compra', 'dias_desde_entrega', 'duravel'], outputs: ['decisao', 'prazo_solucao'] },
    { id: 'var-cp-rule-preco', type: 'rule', name: 'Preço e promoção só da tabela vigente', version: '1.1.0', status: 'publicado_prd', domainId: D.preco, owner: 'dono_negocio',
      description: 'Guardrail de destaque: nenhum agente informa preço fora da tabela vigente ou de campanha encerrada.',
      content: 'SE resposta.preco NAO EM tabela_vigente(sku, data_atual)\nENTAO bloquear_resposta E consultar preco_vigente', inputs: ['resposta do agente', 'tabela vigente'], outputs: ['resposta liberada ou bloqueio'] },
    { id: 'var-cp-doc-trocas', type: 'documento', name: 'Política de trocas v3', version: '3.0.0', status: 'publicado_prd', domainId: D.pedido, owner: 'dono_negocio',
      description: 'Documento de referência versionado da política de trocas.', content: 'Documento: var-doc-trocas (5 trechos). Substitui a Política de trocas v2.', inputs: [], outputs: ['trechos citáveis'],
      log: [['2.0.0', 300, 'Política v2.'], ['3.0.0', 26, 'Prazo estendido para Aurora+ Ouro.']] },
    { id: 'var-cp-skill-estoque', type: 'skill', name: 'Consultar estoque por loja', version: '1.0.0', status: 'homologado', domainId: D.estoque, owner: 'engenheiro_ai',
      description: 'Consulta saldo na loja escolhida e sugere a mais próxima com saldo.', content: 'Instruções: consulte estoque_por_loja; se saldo = 0, ordene lojas por distância e ofereça a primeira com saldo ≥ 1.', inputs: ['sku', 'loja'], outputs: ['saldo', 'loja alternativa'] },
    { id: 'var-cp-pacote-digital', type: 'pacote', name: 'Pacote Atendimento Digital 2.1', version: '2.1.0', status: 'homologado', domainId: D.pedido, owner: 'champion', packageKind: 'jornada',
      description: 'Composição homologada para jornadas curtas de venda e pós-venda.',
      content: 'Componentes fixados:\n- Assistente de compra 1.2.0\n- Agente de trocas e devoluções 2.0.0\n- Preço e promoção só da tabela vigente 1.1.0\n- Mascarar PII antes de enviar ao canal 1.3.0',
      inputs: [], outputs: ['plugin cortex-atendimento-digital@2.1.0'], dependencies: ['var-cp-agent-compra', 'var-cp-agent-trocas', 'var-cp-rule-preco', 'var-cp-hook-pii'] },
    { id: 'var-cp-pacote-reposicao', type: 'pacote', name: 'Esteira de reposição de lojas', version: '0.5.0', status: 'rascunho', domainId: D.estoque, owner: 'champion', packageKind: 'esteira',
      description: 'Esteira diária de reposição a partir do giro.', content: 'Componentes fixados:\n- Consultar estoque por loja 1.0.0', inputs: [], outputs: ['plugin cortex-reposicao@0.5.0'], dependencies: ['var-cp-skill-estoque'] },
  ];

  const journeys: IndustryContent['journeys'] = [
    {
      id: J.anchor, name: 'Assistente de compra com reserva em loja', anchor: true, type: 'agentica', domainId: D.pedido, initiativeId: 'var-in-01',
      description: 'O cliente pergunta pelo produto no WhatsApp; o assistente confere saldo e preço vigente e reserva na loja para retirada.',
      triggerLabel: 'Mensagem do cliente', risk: 'supervisionada',
      brainInputs: ['Catálogo', 'Estoque por loja', 'Regras de promoção'],
      persona: { name: 'Rafael Xavier · cliente Aurora+', message: 'Oi! Vocês têm a air fryer Prática 5L na loja do Shopping Paulista? Queria buscar hoje.' },
      kpis: ['Conversão', 'Reservas retiradas', 'Ruptura evitada'],
      testCases: [
        ['Produto com saldo', 'Tem a air fryer Prática 5L no Shopping Paulista?', 'Confirma saldo, informa preço vigente e reserva', 'passou'],
        ['Produto em ruptura', 'Tem liquidificador Turbo na Barra?', 'Sugere a loja mais próxima com saldo', 'passou'],
        ['Preço de campanha encerrada', 'Faz pelo preço da Black Friday do ano passado?', 'Informa somente o preço vigente', 'falhou'],
      ],
      nodes: [
        { id: 'msg', kind: 'gatilho.mensagem', label: 'Mensagem WhatsApp', at: [0, 1], channelId: 'var-ch-whatsapp', to: 'intencao',
          s: { in: 'Oi! Vocês têm a air fryer Prática 5L na loja do Shopping Paulista? Queria buscar hoje.', out: 'Mensagem de +55 11 9****-7710; cliente Aurora+ identificado (CLI-552907).', ms: 40 } },
        { id: 'intencao', kind: 'agente.intencao', label: 'Classificar intenção', at: [1, 1], to: 'agente',
          s: { in: 'Texto da mensagem', out: 'Intenção: consulta_estoque_loja (0,94); interesse em retirada hoje.', tok: 380, ms: 560 } },
        { id: 'agente', kind: 'agente.agente', label: 'Assistente de compra', at: [2, 1], componentId: 'var-cp-agent-compra', to: 'estoque',
          s: { in: 'Intenção + produto + loja', out: 'Produto identificado: SKU-448120 (Air fryer Prática 5L). Próximos passos: saldo e preço vigente.', rule: 'Assistente de compra 1.2.0', tok: 1180, ms: 1450 } },
        { id: 'estoque', kind: 'dados.produto', label: 'Estoque por loja', at: [3, 1], contractId: 'var-ct-estoque', toolId: 'var-tl-estoque-loja', to: 'preco',
          s: { in: 'sku=SKU-448120, loja=Shopping Paulista', out: 'Saldo 6, reservado 1: 5 disponíveis.', src: 'Contrato Estoque por loja v2.0.0', ms: 620 } },
        { id: 'preco', kind: 'conhecimento.regra', label: 'Preço e promoção vigente', at: [4, 1], ruleId: 'var-dt-promocao', to: 'conteudo',
          s: { in: 'campanha_ativa=sim, membro_aurora=sim, leve3pague2=não', out: 'Linha 3: preço vigente com 10% Aurora+ = R$ 404,91 (lista R$ 499,90; Semana da Cozinha R$ 449,90).', rule: 'Preço e promoção vigente v1.1.0 · linha 3', src: 'Regras de promoção · outubro de 2026', ms: 45 } },
        { id: 'conteudo', kind: 'guardrail.conteudo', label: 'Preço só da tabela vigente', at: [5, 1], componentId: 'var-cp-rule-preco', to: 'cond',
          s: { in: 'Preço proposto R$ 404,91', out: 'Preço confere com a tabela vigente. Liberado.', rule: 'Preço e promoção só da tabela vigente 1.1.0', ms: 30 } },
        { id: 'cond', kind: 'logica.condicao', label: 'Cliente quer reservar?', at: [6, 1], to: { sim: 'reservar', 'não': 'responder' },
          s: { in: '"Queria buscar hoje"', out: 'sim', ms: 15, take: 'sim' } },
        { id: 'reservar', kind: 'dados.tool', label: 'Reservar em loja', at: [7, 0], toolId: 'var-tl-reservar', contractId: 'var-ct-pedido', emitsPii: true, to: 'responder',
          s: { in: 'sku=SKU-448120, loja=Shopping Paulista, cliente=CLI-552907', out: 'Reserva RS-90412 em nome de Rafael Xavier, CPF 264.913.058-05, telefone (11) 97733-7710, e-mail rafael.xavier@email.com.br; válida até 22/10 às 10h.', src: 'Contrato Pedido v2.0.0', ms: 780 } },
        { id: 'responder', kind: 'saida.responder', label: 'Responder no canal', at: [8, 1], channelId: 'var-ch-whatsapp',
          s: { in: 'Reserva + preço', out: 'Rafael, separei a air fryer Prática 5L no Shopping Paulista por R$ 404,91 com seu desconto Aurora+. A reserva RS-90412 vale até amanhã às 10h; é só mostrar o código no balcão de retirada.', ms: 230 } },
      ],
      versions: [
        { version: '0.1.0', daysAgo: 8, author: 'champion', note: 'Rascunho gerado por /cortex:desenhar a partir da iniciativa.', drop: ['intencao', 'conteudo'] },
        { version: '0.2.0', daysAgo: 2, author: 'engenheiro_ai', note: 'Inclui classificação de intenção e o guardrail de preço vigente.' },
      ],
      envVersions: { dev: '0.2.0', hml: null, prd: null },
      piiFilter: { in: 'Saída de "Reservar em loja" com nome completo, CPF, telefone e e-mail', out: 'Reserva RS-90412 em nome de Rafael, CPF ***.913.058-**, telefone (11) 9****-7710; e-mail removido. Válida até 22/10 às 10h.' },
    },
    {
      id: J.prd, name: 'Troca e devolução', type: 'agentica', domainId: D.pedido, initiativeId: 'var-in-05',
      description: 'O cliente pede a troca no app; o agente confere pedido e nota fiscal, aplica a política e gera etiqueta ou vale.',
      triggerLabel: 'Pedido de troca no app', risk: 'supervisionada',
      brainInputs: ['Política de trocas', 'CDC', 'Pedido e nota fiscal'],
      persona: { name: 'Camila Siqueira · cliente Aurora+ Ouro', message: 'Meu liquidificador parou de funcionar com 12 dias de uso. Quero trocar.' },
      kpis: ['Tempo de troca', 'Trocas sem atendente', 'NPS pós-troca'],
      testCases: [
        ['Defeito em item durável', 'Liquidificador parou com 12 dias', 'Troca imediata ou reembolso em até 10 dias', 'passou'],
        ['Arrependimento fora do prazo', 'Comprei no site há 15 dias e me arrependi', 'Informa prazo de 7 dias e oferece vale de cortesia', 'passou'],
        ['Tamanho errado', 'A camiseta ficou pequena', 'Troca por outro tamanho em até 30 dias', 'passou'],
      ],
      nodes: [
        { id: 'pedido', kind: 'gatilho.mensagem', label: 'Pedido de troca', at: [0, 1], channelId: 'var-ch-app', to: 'cliente',
          s: { in: 'Meu liquidificador parou de funcionar com 12 dias de uso. Quero trocar.', out: 'Pedido de troca aberto no app para o pedido PED-7720431.', ms: 40 } },
        { id: 'cliente', kind: 'dados.produto', label: 'Ler perfil do cliente', at: [1, 1], contractId: 'var-ct-cliente', emitsPii: true, to: 'nf',
          s: { in: 'cliente_id=CLI-104882', out: 'Cliente Aurora+ Ouro, loja preferida Campinas Centro.', src: 'Contrato Cliente v2.0.0', ms: 150 } },
        { id: 'nf', kind: 'dados.tool', label: 'Consultar pedido e nota fiscal', at: [2, 1], toolId: 'var-tl-consultar-pedido', contractId: 'var-ct-pedido', to: 'regra',
          s: { in: 'pedido_id=PED-7720431', out: 'Liquidificador Turbo 900W, NF-e 88120, entregue em 09/10 (12 dias), compra online.', src: 'Contrato Pedido v2.0.0', ms: 310 } },
        { id: 'regra', kind: 'logica.tabela', label: 'Troca e devolução', at: [3, 1], ruleId: 'var-dt-troca', componentId: 'var-cp-rule-troca', to: 'agente',
          s: { in: 'motivo=defeito, canal_compra=online, dias_desde_entrega=12, duravel=sim', out: 'Linha 4: troca imediata ou reembolso; prazo de solução de 10 dias.', rule: 'Troca e devolução v3.0.0 · linha 4', src: 'Política de trocas v3 · trecho 2', ms: 30 } },
        { id: 'agente', kind: 'agente.agente', label: 'Agente de trocas', at: [4, 1], componentId: 'var-cp-agent-trocas', to: 'cond',
          s: { in: 'Decisão da regra + preferência do cliente', out: 'Oferece troca na loja Campinas Centro hoje ou coleta em casa com reembolso; cliente escolhe a loja.', rule: 'Agente de trocas e devoluções 2.0.0', tok: 1260, ms: 1520 } },
        { id: 'cond', kind: 'logica.condicao', label: 'Troca aprovada?', at: [5, 1], to: { sim: 'gerar', 'não': 'transbordo' },
          s: { in: 'decisao = Troca imediata ou reembolso', out: 'sim', ms: 10, take: 'sim' } },
        { id: 'gerar', kind: 'dados.tool', label: 'Gerar autorização de troca', at: [6, 0], toolId: 'var-tl-gerar-troca', to: 'pii',
          s: { in: 'Troca em loja: Campinas Centro', out: 'Autorização TC-55120 gerada; produto novo separado na loja.', ms: 640 } },
        { id: 'pii', kind: 'guardrail.pii', label: 'Filtro de PII', at: [7, 0], componentId: 'var-cp-hook-pii', to: 'responder',
          s: { in: 'Resposta com nome completo e CPF', out: 'Nome reduzido a "Camila"; CPF removido.', rule: 'Mascarar PII antes de enviar ao canal 1.3.0', ms: 30 } },
        { id: 'responder', kind: 'saida.responder', label: 'Responder no canal', at: [8, 0], channelId: 'var-ch-app',
          s: { in: 'Autorização TC-55120', out: 'Camila, sua troca foi aprovada. Um liquidificador novo está separado na loja Campinas Centro; apresente o código TC-55120 no balcão.', ms: 200 } },
        { id: 'transbordo', kind: 'pessoas.transbordo', label: 'Transbordo para atendente', at: [6, 2], componentId: 'var-cp-skill-resumo',
          s: { in: 'Caso fora da política', out: 'Conversa enviada à fila de pós-venda com resumo.', ms: 120 } },
      ],
      versions: [
        { version: '1.0.0', daysAgo: 110, author: 'champion', note: 'Primeira versão em produção.', drop: ['agente', 'nf'] },
        { version: '1.1.0', daysAgo: 45, author: 'engenheiro_ai', note: 'Agente de trocas conduz a escolha entre loja e coleta.', drop: ['nf'] },
        { version: '1.2.0', daysAgo: 4, author: 'engenheiro_ai', note: 'Consulta pedido e nota fiscal automaticamente.' },
      ],
      envVersions: { dev: '1.2.0', hml: '1.2.0', prd: '1.1.0' },
    },
    {
      id: J.auto, name: 'Reposição de estoque por loja', type: 'automacao', domainId: D.estoque, initiativeId: 'var-in-04',
      description: 'Automação diária sem agente: lê o giro, aplica o estoque mínimo e cria transferências do CD.',
      triggerLabel: 'Agendamento diário', risk: 'autonoma',
      brainInputs: ['Produto de dados de giro', 'Regras de estoque mínimo'],
      persona: { name: 'Rotina agendada', message: 'Rotina das 5h: 86 lojas, 1,2 milhão de pares SKU-loja.' },
      kpis: ['Ruptura', 'Transferências urgentes'],
      testCases: [
        ['Curva A com 2 dias', 'Cobertura de 2,5 dias, curva A', 'Cria transferência urgente', 'passou'],
        ['Cobertura alta', 'Cobertura de 12 dias', 'Não repõe', 'passou'],
      ],
      nodes: [
        { id: 'rotina', kind: 'gatilho.agendamento', label: 'Rotina diária 5h', at: [0, 0], to: 'giro',
          s: { in: 'cron 0 5 * * *', out: 'Execução iniciada para 86 lojas.', ms: 20 } },
        { id: 'giro', kind: 'dados.produto', label: 'Ler giro por loja', at: [1, 0], contractId: 'var-ct-estoque', to: 'minimo',
          s: { in: 'loja=Barra, sku=SKU-448120', out: 'Cobertura de 2,5 dias; curva A.', src: 'Contrato Estoque por loja v2.0.0', ms: 260 } },
        { id: 'minimo', kind: 'logica.tabela', label: 'Estoque mínimo', at: [2, 0], ruleId: 'var-dt-estoque-min', to: 'cond',
          s: { in: 'cobertura_dias=2,5, curva=A', out: 'Linha 1: repor com urgência.', rule: 'Estoque mínimo por loja v1.0.0 · linha 1', ms: 15 } },
        { id: 'cond', kind: 'logica.condicao', label: 'Precisa repor?', at: [3, 0], to: { sim: 'transferir', 'não': 'fim' },
          s: { in: 'acao = Repor com urgência', out: 'sim', ms: 10, take: 'sim' } },
        { id: 'transferir', kind: 'dados.tool', label: 'Criar transferência no WMS', at: [4, 0], toolId: 'var-tl-transferencia', to: 'avisar',
          s: { in: '12 unidades do CD Cajamar para a Barra', out: 'Transferência TR-118204 criada; chegada prevista amanhã às 7h.', ms: 1420 } },
        { id: 'avisar', kind: 'saida.notificar', label: 'Avisar gerente da loja', at: [5, 0], channelId: 'var-ch-backoffice', to: 'fim',
          s: { in: 'TR-118204', out: 'Alerta no backoffice da loja Barra.', ms: 90 } },
        { id: 'fim', kind: 'saida.encerrar', label: 'Encerrar', at: [6, 0], s: { in: 'Fluxo concluído', out: 'Encerrado.', ms: 5 } },
      ],
      versions: [
        { version: '0.9.0', daysAgo: 20, author: 'engenheiro_ai', note: 'Reposição com limiar fixo.', drop: ['minimo'] },
        { version: '1.0.0', daysAgo: 6, author: 'engenheiro_ai', note: 'Limiar vem da tabela de estoque mínimo.' },
      ],
      envVersions: { dev: '1.0.0', hml: '1.0.0', prd: null },
    },
  ];

  const initiatives: IndustryContent['initiatives'] = [
    {
      id: 'var-in-01', title: 'Cliente reserva produto na loja pelo WhatsApp', type: 'nova_jornada', domainId: D.pedido, owner: u('dono_negocio'),
      stage: 'ideia', expectedValueBRL: 3400000, health: 'ok', journeyId: J.anchor,
      problem: 'Clientes perguntam por estoque nas lojas e 40% desistem por falta de resposta rápida.', objective: 'Responder estoque e preço vigente e reservar na loja pelo WhatsApp.',
      metric: 'Conversão digital de 2,1% para 3,2%',
      validation: {
        checks: [
          { key: 'estrategia', label: 'Estratégia', result: 'verde', summary: 'Move os OKRs de conversão digital e de ruptura.', source: 'Empresa · OKRs 2026' },
          { key: 'mercado', label: 'Mercado e regulação', result: 'verde', summary: 'Concorrentes vendem até 8% do digital pelo WhatsApp; preço anunciado deve ser o cobrado.', source: 'Mercado · Vendas conversacionais (out/2026)' },
          { key: 'regras', label: 'Regras de negócio', result: 'verde', summary: 'Usa "Preço e promoção vigente" v1.1.0 e o guardrail de preço.', source: 'Regras de negócio' },
          { key: 'dados', label: 'Dados', result: 'amarelo', summary: 'Contratos Estoque e Pedido publicados. Lacuna de dado: saldo por loja atualizado a cada 4 horas, sem reservas em tempo real.', source: 'Dados · Contrato Estoque por loja' },
          { key: 'integracoes', label: 'Integrações e canais', result: 'amarelo', summary: 'OMS e VTEX conectados; WMS com latência degradada; WhatsApp sem jornada vinculada.', source: 'Conectores e Canais' },
          { key: 'arquitetura', label: 'Arquitetura', result: 'verde', summary: 'Padrão "Agente com recuperação e tools"; solução do tipo agente.', source: 'Arquitetura · referências' },
          { key: 'reuso', label: 'Reuso', result: 'verde', summary: '70% de reuso: Assistente de compra, Consultar estoque por loja, Preço e promoção vigente e Mascarar PII.', source: 'Catálogo · Pacote Atendimento Digital 2.1' },
          { key: 'business_case', label: 'Business case', result: 'verde', summary: 'R$ 3,4 milhões por ano em vendas recuperadas (premissa: 9 mil reservas/mês, 62% retiradas, ticket R$ 510).', source: 'Telemetria · funil digital' },
        ],
        recommendation: 'O cérebro indica seguir como jornada agêntica supervisionada, reaproveitando o Pacote Atendimento Digital 2.1. Recomendamos avaliar a atualização do saldo por loja antes da construção.',
        attention: ['Lacuna de dado: saldo por loja atualizado a cada 4 horas', 'Conector do WMS degradado', 'Dado pessoal chega ao WhatsApp: exigir filtro de PII'],
        reusePct: 70, solutionType: 'agente',
      },
    },
    { id: 'var-in-02', title: 'Lista de casamento omnichannel', type: 'novo_produto', domainId: D.produto, owner: u('dono_negocio'), stage: 'ideia', expectedValueBRL: 1200000, health: 'ok',
      problem: 'Listas só existem no site.', objective: 'Lista compartilhável com retirada em loja.', metric: 'Receita de listas: +40%' },
    { id: 'var-in-03', title: 'Precificação dinâmica de eletroportáteis', type: 'eficiencia', domainId: D.preco, owner: u('dono_negocio'), stage: 'validacao', expectedValueBRL: 2600000, health: 'atencao',
      problem: 'Ajustes de preço levam 3 dias.', objective: 'Sugestão diária de preço dentro das regras comerciais.', metric: 'Margem bruta da categoria: +1,2 p.p.' },
    { id: 'var-in-04', title: 'Reposição de estoque por loja', type: 'eficiencia', domainId: D.estoque, owner: u('champion'), stage: 'construcao', expectedValueBRL: 2900000, health: 'ok', journeyId: J.auto,
      problem: 'Ruptura de 8,4% nas lojas.', objective: 'Reposição diária a partir do giro e da regra de estoque mínimo.', metric: 'Ruptura de 8,4% para 4%',
      validation: okValidation('O cérebro indica seguir como automação sem agente.', ['WMS degradado pode atrasar transferências'], 52, 'automacao') },
    { id: 'var-in-05', title: 'Troca e devolução pelo app', type: 'nova_jornada', domainId: D.pedido, owner: u('dono_negocio'), stage: 'operacao', expectedValueBRL: 1800000, health: 'ok', journeyId: J.prd,
      problem: 'Trocas levavam 9 dias e geravam reclamações.', objective: 'Troca resolvida no app com a política vigente.', metric: 'Tempo de troca de 9 para 3 dias',
      validation: okValidation('O cérebro indica seguir com a Política de trocas v3 como fonte única.', [], 64, 'agente') },
    { id: 'var-in-06', title: 'Provador virtual de moda praia', type: 'novo_produto', domainId: D.produto, owner: u('champion'), stage: 'prototipo', expectedValueBRL: 700000, health: 'atencao',
      problem: 'Devolução de 22% em moda praia por tamanho.', objective: 'Recomendação de tamanho no app.', metric: 'Trocas por tamanho: -30%' },
    { id: 'var-in-07', title: 'Agente de apoio ao vendedor de loja', type: 'agente_ia', domainId: D.loja, owner: u('champion'), stage: 'prototipo', expectedValueBRL: 950000, health: 'ok',
      problem: 'Vendedores consultam 4 sistemas para responder ao cliente.', objective: 'Agente no tablet da loja com catálogo, estoque e políticas.', metric: 'Tempo de atendimento em loja: -25%' },
    { id: 'var-in-08', title: 'Modernização do PDV', type: 'modernizacao', domainId: D.loja, owner: u('champion'), stage: 'construcao', expectedValueBRL: 1500000, health: 'risco',
      problem: 'PDV legado sem integração com reservas.', objective: 'PDV integrado ao OMS e às jornadas.', metric: 'Fila no caixa: -35%' },
    { id: 'var-in-09', title: 'Campanha personalizada por segmento Aurora+', type: 'agente_ia', domainId: D.cliente, owner: u('dono_negocio'), stage: 'validacao', expectedValueBRL: 2200000, health: 'ok',
      problem: 'Campanhas iguais para toda a base.', objective: 'Ofertas por segmento com consentimento.', metric: 'Conversão de campanhas: +50%' },
  ];

  const policies: IndustryContent['policies'] = [
    { id: 'var-pol-preco', name: 'Preço e promoção só da tabela vigente', kind: 'jornada', description: 'Nenhuma resposta de agente pode citar preço fora da tabela vigente do ERP ou de campanha encerrada.', condition: 'quando a resposta citar preço diferente da tabela vigente', effect: 'bloquear', envs: ['dev', 'hml', 'prd'], active: true,
      code: JSON.stringify({ policy: 'preco-vigente', when: { response: { price: { notIn: 'tabela_vigente' } } }, then: 'bloquear' }, null, 2) },
    { id: 'var-pol-troca', name: 'Reembolso acima de R$ 2 mil exige aprovação', kind: 'jornada', description: 'A tool gerar_troca conclui sozinha reembolsos até R$ 2 mil; acima disso, exige aprovação do dono de negócio.', condition: 'quando o reembolso passar de R$ 2.000', effect: 'exigir_aprovacao', envs: ['prd'], active: true,
      code: JSON.stringify({ policy: 'reembolso-alcada', when: { tool: 'gerar_troca', input: { reembolso: { gt: 2000 } } }, then: { exigir_aprovacao: ['dono_negocio'] } }, null, 2) },
  ];

  return {
    workspace: { id: 'ws-varejo', industry: 'varejo', company: 'Aurora Varejo', segment: 'Varejista omnichannel', tagline: 'Casa, cozinha e tecnologia em qualquer canal',
      description: 'Varejista fictícia com 86 lojas, e-commerce, app e 1,8 milhão de clientes. Vende por WhatsApp, e-commerce, app, PDV e backoffice de loja.' },
    userDomains: { dono_negocio: [D.pedido, D.preco, D.cliente], champion: [D.cliente, D.produto, D.estoque, D.pedido, D.preco, D.loja], engenheiro_ai: [D.pedido, D.estoque], engenheiro_dados: Object.values(D), seguranca: [D.cliente], patrocinador: [D.pedido] },
    systems, connectors, channels, domains, contracts, tables, sqlExamples,
    lineage: [
      ['var-con-oms', 'var-tb-brz-pedidos'], ['var-con-wms', 'var-tb-brz-saldo'],
      ['var-tb-brz-pedidos', 'var-tb-prt-pedidos'], ['var-tb-brz-saldo', 'var-tb-prt-saldo'],
      ['var-tb-prt-pedidos', 'var-tb-our-trocas'], ['var-tb-prt-saldo', 'var-tb-our-estoque'],
      ['var-tb-our-trocas', 'var-ct-pedido'], ['var-tb-our-estoque', 'var-ct-estoque'],
      ['var-ct-pedido', J.prd], ['var-ct-estoque', J.anchor], ['var-ct-pedido', J.anchor],
      [J.prd, 'var-ch-app'], [J.anchor, 'var-ch-whatsapp'],
    ],
    collections, documents, retrievals, knowledgeGraph,
    coverage: [81, 62, 74, 69, 85, 58, 66, 71, 38, 24],
    artifacts, decisionTables, components, journeys, initiatives, policies,
    kpis: [
      { name: 'Conversão', unit: '%', baseline: 2.1, current: 2.9, target: 3.2, better: 'up' },
      { name: 'Ruptura', unit: '%', baseline: 8.4, current: 5.6, target: 4, better: 'down' },
      { name: 'Tempo de troca', unit: 'dias', baseline: 9, current: 4.5, target: 3, better: 'down' },
      { name: 'NPS', unit: 'pontos', baseline: 44, current: 58, target: 65, better: 'up' },
    ],
    guardrail: { text: 'Preço e promoção só da tabela vigente: vale com valor de campanha encerrada bloqueado', nodeId: 'agente' },
    dailyVolume: 7800,
    suggestions: ({ journeys: js }) => {
      const prdJ = js.find((j) => j.id === J.prd)!;
      return [
        { id: 'var-sg-1', kind: 'skill', title: 'Criar skill "Troca de produto comprado em promoção"', status: 'nova', journeyId: J.prd, sourceDocId: 'var-doc-trocas',
          evidence: `32% dos transbordos da jornada ${prdJ.name} ocorrem na mesma pergunta ("posso trocar produto comprado na promoção?"); criar skill a partir do documento Política de trocas v3?`,
          proposal: 'Skill que explica que a troca vale também para itens em promoção, pelo valor pago, citando a Política de trocas v3.' },
        { id: 'var-sg-2', kind: 'regra', title: 'Prazo estendido Aurora+ Ouro na regra de troca', status: 'nova', journeyId: J.prd, sourceDocId: 'var-doc-trocas',
          evidence: 'A política v3 prevê 45 dias para Aurora+ Ouro, mas a tabela de decisão ainda usa 30 dias para tamanho ou cor.',
          proposal: 'Adicionar a entrada "segmento_fidelidade" e uma linha para Aurora+ Ouro com 45 dias.' },
      ];
    },
  };
}
