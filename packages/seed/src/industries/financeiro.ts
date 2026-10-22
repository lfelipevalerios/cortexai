// Banco Lumen: banco digital (empresa fictícia).
import type { Channel, DataDomain, DecisionTable, EcosystemSystem } from '@cortex/schemas';
import type { IndustryContent, IndustryMeta, Ctx } from '../common';
import { connector, contract, obj, table, dateAgo, okValidation } from '../common';

const W = 'fin';
export const meta: IndustryMeta = {
  industry: 'financeiro', p: W, ws: 'ws-financeiro', seed: 0xf1a4ce,
  people: {
    patrocinador: 'Patrícia Valença', dono_negocio: 'Otávio Cardoso', champion: 'Mariana Teixeira', engenheiro_ai: 'Bruno Lacerda',
    engenheiro_dados: 'Helena Machado', coe: 'Carlos Gomes', seguranca: 'Renata Queiroz', admin: 'Daniela Siqueira',
  },
  coreName: 'Core bancário', coreConnectorId: 'fin-con-core', org: 'banco-lumen', repo: 'jornadas-atendimento',
};

export const DEMO = {
  anchorJourneyId: 'fin-jr-contestacao-pix', prdJourneyId: 'fin-jr-credito-pj', anchorInitiativeId: 'fin-in-01',
  whatsappChannelId: 'fin-ch-whatsapp', showcaseDecisionTableId: 'fin-dt-med',
  showcaseQuestion: 'qual o prazo para o cliente contestar um PIX feito em golpe?', crmSystemId: 'fin-sys-crm',
};
export const BREAKING = { contractId: 'fin-ct-cliente', field: 'nivel_kyc' };

export function crmPreset(ctx: Ctx) {
  return {
    typeId: 'salesforce', name: 'CRM (Salesforce Financial Services)', domainId: 'fin-dom-cliente',
    endpoint: 'https://bancolumen.my.salesforce.example/services/data/v61.0',
    objects: [
      obj(ctx, 'Pessoa (PersonAccount)', 'objeto', 2640000, [['id', 'string', 'id:001P'], ['nome', 'string', 'nome'], ['cpf', 'string', 'cpf'], ['email', 'string', 'email'], ['telefone', 'string', 'telefone'], ['segmento', 'string', 'enum:Lumen|Lumen Prime|PJ']],
        { row0: { nome: 'Lucas P****', cpf: '***.736.251-**', telefone: '(21) 9****-1180' } }),
      obj(ctx, 'Empresa (Account)', 'objeto', 182000, [['id', 'string', 'id:001E'], ['razao_social', 'string', 'empresa'], ['cnpj', 'string', 'cnpj'], ['faturamento_anual', 'decimal', 'valor:120000:24000000']]),
      obj(ctx, 'Atendimento (Case)', 'objeto', 4830000, [['id', 'string', 'id:500A'], ['cliente_id', 'string', 'id:001P'], ['assunto', 'string', 'enum:PIX|Cartão|Crédito|Conta'], ['status', 'string', 'enum:Aberto|Fechado'], ['aberto_em', 'datetime', 'datahora:0:60']]),
    ],
    tools: [
      { id: 'fin-tl-crm-consultar-cliente', name: 'consultar_cliente', description: 'Busca o cliente por CPF, CNPJ ou telefone.', mode: 'leitura' as const, enabledByEnv: { dev: true, hml: true, prd: true } },
      { id: 'fin-tl-crm-casos', name: 'listar_atendimentos', description: 'Atendimentos recentes do cliente.', mode: 'leitura' as const, enabledByEnv: { dev: true, hml: true, prd: true } },
      { id: 'fin-tl-crm-registrar-caso', name: 'registrar_atendimento', description: 'Abre um caso de atendimento.', mode: 'escrita' as const, enabledByEnv: { dev: true, hml: true, prd: false } },
    ],
  };
}

export function build(ctx: Ctx): IndustryContent {
  const u = ctx.u;
  const D = {
    cliente: 'fin-dom-cliente', conta: 'fin-dom-conta', transacao: 'fin-dom-transacao', credito: 'fin-dom-credito',
    cartao: 'fin-dom-cartao', contestacao: 'fin-dom-contestacao', eventos: 'fin-dom-eventos', logs: 'fin-dom-logs',
  };
  const J = { anchor: 'fin-jr-contestacao-pix', prd: 'fin-jr-credito-pj', auto: 'fin-jr-alerta' };

  const connectors = [
    connector(ctx, {
      id: 'fin-con-core', typeId: 'soap', name: 'Core bancário', domainId: D.conta, syncMode: 'cdc',
      volume: 2640000, latencyMs: 380, consumers: [J.prd, 'fin-ct-cliente', 'fin-ct-conta'],
      endpoint: 'https://core-{env}.bancolumen.example/ws/contas?wsdl',
      objects: [
        obj(ctx, 'ConsultarCliente', 'endpoint', 2640000, [['cliente_id', 'string', 'id:CL-'], ['nome', 'string', 'nome'], ['cpf', 'string', 'cpf'], ['data_nascimento', 'date', 'nascimento'], ['nivel_kyc', 'string', 'enum:completo|completo|pendente']],
          { row0: { nome: 'Lucas P****', cpf: '***.736.251-**' } }),
        obj(ctx, 'ConsultarConta', 'endpoint', 2910000, [['conta', 'string', 'id:0001-'], ['cliente_id', 'string', 'id:CL-'], ['tipo', 'string', 'enum:corrente|pagamento|PJ'], ['saldo', 'decimal', 'valor:0:84000'], ['status', 'string', 'enum:ativa|bloqueada']]),
      ],
      tools: [
        ['fin-tl-consultar-cliente', 'consultar_cliente_core', 'Cadastro e nível de KYC do cliente.', 'leitura'],
        ['fin-tl-saldo', 'consultar_saldo', 'Saldo disponível da conta.', 'leitura'],
      ],
    }),
    connector(ctx, {
      id: 'fin-con-pix', typeId: 'pix', name: 'PIX · SPI e DICT', domainId: D.transacao, syncMode: 'cdc',
      volume: 18700000, latencyMs: 220, consumers: [J.anchor, 'fin-ct-transacao', 'fin-ct-contestacao'],
      endpoint: 'https://pix-{env}.bancolumen.example/api/v2',
      objects: [
        obj(ctx, 'pix/transacoes', 'endpoint', 18700000, [['e2e_id', 'string', 'id:E2E'], ['pagador_cpf', 'string', 'cpf'], ['recebedor', 'string', 'nome'], ['valor', 'decimal', 'valor:5:9000'], ['realizado_em', 'datetime', 'datahora:0:30']]),
        obj(ctx, 'pix/devolucoes-med', 'endpoint', 41200, [['med_id', 'string', 'id:MED-'], ['e2e_id', 'string', 'id:E2E'], ['motivo', 'string', 'enum:fraude|falha operacional'], ['status', 'string', 'enum:aberto|em análise|devolvido|negado'], ['aberto_em', 'datetime', 'datahora:0:60']]),
      ],
      tools: [
        ['fin-tl-consultar-pix', 'consultar_pix', 'Transação PIX pelo identificador ou pelos últimos envios do cliente.', 'leitura'],
        ['fin-tl-abrir-med', 'abrir_med', 'Abre pedido de devolução pelo MED com bloqueio cautelar.', 'escrita', 'fin-pol-alcada'],
      ],
    }),
    connector(ctx, {
      id: 'fin-con-antifraude', typeId: 'kafka', name: 'Antifraude · eventos', domainId: D.eventos, syncMode: 'cdc',
      volume: 31200000, latencyMs: 35, consumers: [J.auto, J.anchor],
      endpoint: 'kafka-{env}.bancolumen.example:9093',
      objects: [
        obj(ctx, 'antifraude.alertas.v3', 'objeto', 31200000, [['alerta_id', 'string', 'id:AF-'], ['cliente_id', 'string', 'id:CL-'], ['score_fraude', 'decimal', 'pct:0:1'], ['dispositivo_novo', 'boolean', 'bool:0.2'], ['ocorrido_em', 'timestamp', 'datahora:0:1']]),
        obj(ctx, 'antifraude.contas_marcadas.v1', 'objeto', 88400, [['chave_hash', 'string', 'hash'], ['motivo', 'string', 'enum:golpe confirmado|suspeita'], ['marcado_em', 'date', 'data:0:200']]),
      ],
      tools: [
        ['fin-tl-sinais-fraude', 'sinais_de_fraude', 'Sinais de fraude da transação e da conta recebedora.', 'leitura'],
        ['fin-tl-bloquear-cartao', 'bloquear_cartao', 'Bloqueio preventivo do cartão.', 'escrita'],
      ],
    }),
    connector(ctx, {
      id: 'fin-con-openfinance', typeId: 'open-finance', name: 'Open Finance · dados compartilhados', domainId: D.credito, syncMode: 'sob_demanda',
      volume: 412000, latencyMs: 690, consumers: [J.prd, 'fin-ct-credito'],
      endpoint: 'https://openfinance-{env}.bancolumen.example/open-banking',
      objects: [
        obj(ctx, 'consents', 'endpoint', 412000, [['consentimento_id', 'string', 'id:urn:lumen:'], ['cnpj', 'string', 'cnpj'], ['escopo', 'string', 'enum:contas|operações de crédito|recebíveis'], ['valido_ate', 'date', 'data:0:300']]),
        obj(ctx, 'credit-operations', 'endpoint', 1260000, [['contrato', 'string', 'id:OP-'], ['cnpj', 'string', 'cnpj'], ['modalidade', 'string', 'enum:capital de giro|antecipação|conta garantida'], ['saldo_devedor', 'decimal', 'valor:5000:900000']]),
      ],
      tools: [['fin-tl-of-dados', 'dados_open_finance', 'Operações e contas de outras instituições, com consentimento ativo.', 'leitura']],
    }),
    connector(ctx, {
      id: 'fin-con-bureau', typeId: 'rest-openapi', name: 'Bureau de crédito · API', status: 'degradado', domainId: D.credito, syncMode: 'sob_demanda',
      volume: 96400, latencyMs: 1610, consumers: [J.prd],
      endpoint: 'https://bureau-{env}.parceiro.example/v1',
      objects: [
        obj(ctx, 'GET /score-pj', 'endpoint', 96400, [['cnpj', 'string', 'cnpj'], ['score', 'integer', 'int:120:980'], ['rating', 'string', 'enum:A|B|C|D'], ['consultado_em', 'datetime', 'datahora:0:30']]),
        obj(ctx, 'GET /restricoes', 'endpoint', 21800, [['cnpj', 'string', 'cnpj'], ['tipo', 'string', 'enum:protesto|ação judicial|nenhuma'], ['valor', 'decimal', 'valor:0:180000']]),
      ],
      tools: [['fin-tl-bureau', 'consultar_bureau', 'Score, rating e restrições da empresa.', 'leitura']],
    }),
  ];

  const channels: Channel[] = [
    { id: 'fin-ch-whatsapp', type: 'whatsapp', name: 'WhatsApp Lumen', status: 'ativo', config: { numero: '+55 21 4000-0303', templates: 'protocolo_med, alerta_seguranca', optin: 'obrigatório', horario: '24 horas' }, journeyByEnv: {} },
    { id: 'fin-ch-app', type: 'app', name: 'App Lumen', status: 'ativo', config: { sdk: 'cortex-sdk 2.4', autenticacao: 'biometria' }, journeyByEnv: { dev: J.auto, hml: J.auto } },
    { id: 'fin-ch-ib', type: 'webchat', name: 'Internet banking PJ', status: 'ativo', config: { cor: '#A07EFC', boasVindas: 'Olá! Vamos simular seu crédito?', horario: '24 horas' }, journeyByEnv: { dev: J.prd, hml: J.prd, prd: J.prd } },
    { id: 'fin-ch-backoffice', type: 'backoffice', name: 'Backoffice de crédito e fraude', status: 'ativo', config: { fila: 'Comitê PJ e analistas de fraude', sugestoes: 'ativadas' }, journeyByEnv: { dev: J.prd, hml: J.prd, prd: J.prd } },
  ];

  const systems: EcosystemSystem[] = [
    { id: 'fin-sys-crm', name: 'CRM', category: 'crm' },
    { id: 'fin-sys-core', name: 'Core bancário', category: 'api', connectorId: 'fin-con-core' },
    { id: 'fin-sys-pix', name: 'PIX', category: 'setorial', connectorId: 'fin-con-pix' },
    { id: 'fin-sys-antifraude', name: 'Antifraude', category: 'eventos', connectorId: 'fin-con-antifraude' },
    { id: 'fin-sys-openfinance', name: 'Open Finance', category: 'setorial', connectorId: 'fin-con-openfinance' },
    { id: 'fin-sys-bureau', name: 'Bureau de crédito', category: 'api', connectorId: 'fin-con-bureau' },
    { id: 'fin-sys-whatsapp', name: 'WhatsApp', category: 'canal' },
    { id: 'fin-sys-app', name: 'App Lumen', category: 'canal' },
    { id: 'fin-sys-ib', name: 'Internet banking', category: 'canal' },
    { id: 'fin-sys-backoffice', name: 'Backoffice', category: 'canal' },
  ];

  const domains: DataDomain[] = [
    { id: D.cliente, name: 'Cliente e KYC', kind: 'negocio', owner: u('dono_negocio'), description: 'Pessoas e empresas, nível de KYC, consentimentos e segmento.', entities: ['Cliente', 'Empresa', 'KYC'], relations: [D.conta, D.credito, D.cartao], products: ['fin-tb-our-cliente'], consumers: [J.prd], position: { x: 0, y: 0 } },
    { id: D.conta, name: 'Conta', kind: 'negocio', owner: u('champion'), description: 'Contas corrente, de pagamento e PJ, com saldos e limites.', entities: ['Conta', 'Limite'], relations: [D.cliente, D.transacao], products: [], consumers: [], position: { x: 300, y: 0 } },
    { id: D.transacao, name: 'Transação', kind: 'negocio', owner: u('champion'), description: 'PIX, TED, boletos e compras no cartão.', entities: ['Transação PIX', 'TED', 'Boleto'], relations: [D.conta, D.contestacao, D.cartao], products: ['fin-tb-our-pix'], consumers: [J.anchor, J.auto], position: { x: 600, y: 0 } },
    { id: D.credito, name: 'Crédito', kind: 'negocio', owner: u('dono_negocio'), description: 'Propostas, ratings, limites e operações de crédito PJ.', entities: ['Proposta', 'Operação', 'Rating'], relations: [D.cliente], products: ['fin-tb-our-credito'], consumers: [J.prd], position: { x: 0, y: 240 } },
    { id: D.cartao, name: 'Cartão', kind: 'negocio', owner: u('champion'), description: 'Cartões, bloqueios e faturas.', entities: ['Cartão', 'Bloqueio'], relations: [D.cliente, D.transacao], products: [], consumers: [J.auto], position: { x: 300, y: 240 } },
    { id: D.contestacao, name: 'Contestação', kind: 'negocio', owner: u('dono_negocio'), description: 'Contestações de PIX e cartão, MED e devoluções.', entities: ['Contestação', 'MED', 'Devolução'], relations: [D.transacao, D.cliente], products: [], consumers: [J.anchor], position: { x: 600, y: 240 } },
    { id: D.eventos, name: 'Eventos', kind: 'tecnico', owner: u('engenheiro_dados'), description: 'Alertas do antifraude e eventos de transação em tempo real.', entities: ['Alerta', 'Evento de transação'], relations: [D.transacao], products: [], consumers: [J.auto], position: { x: 900, y: 80 } },
    { id: D.logs, name: 'Logs', kind: 'tecnico', owner: u('engenheiro_dados'), description: 'Traces das jornadas, auditoria e telemetria do Claude Code.', entities: ['Trace', 'Evento de auditoria'], relations: [D.eventos], products: [], consumers: [], position: { x: 900, y: 360 } },
  ];

  const contracts = [
    contract(ctx, {
      id: 'fin-ct-cliente', name: 'Contrato Cliente', domainId: D.cliente, entity: 'Cliente', owner: u('engenheiro_dados'),
      fields: [
        ['cliente_id', 'string', true, 'interno', 'Identificador no core bancário.'],
        ['nome', 'string', true, 'pii', 'Nome ou razão social.'],
        ['cpf_cnpj', 'string', true, 'pii', 'Documento do cliente.'],
        ['data_nascimento', 'date', false, 'pii', 'Data de nascimento (PF).'],
        ['telefone', 'string', true, 'pii', 'Celular cadastrado.'],
        ['nivel_kyc', 'string', true, 'interno', 'completo ou pendente; condiciona crédito e limites.'],
        ['renda_faturamento', 'decimal', false, 'sensivel', 'Renda (PF) ou faturamento anual (PJ).'],
        ['pep', 'boolean', true, 'sensivel', 'Pessoa exposta politicamente.'],
      ],
      addedInV2: ['renda_faturamento', 'pep'],
      removedInV2: [['profissao_texto', 'string', false, 'interno', 'Texto livre substituído por código CBO.']],
      v2Note: 'Cliente v2: inclui renda/faturamento e indicador PEP; remove profissão em texto livre.',
      freshness: '1h', expectedVolume: '2,6 milhões de clientes',
    }),
    contract(ctx, {
      id: 'fin-ct-transacao', name: 'Contrato Transação PIX', domainId: D.transacao, entity: 'Transação PIX', owner: u('engenheiro_dados'),
      fields: [
        ['e2e_id', 'string', true, 'interno', 'Identificador fim a fim.'],
        ['cliente_id', 'string', true, 'interno', 'Pagador.', 'Cliente.cliente_id'],
        ['valor', 'decimal', true, 'interno', 'Valor em reais.'],
        ['recebedor_nome', 'string', true, 'pii', 'Nome do recebedor.'],
        ['recebedor_instituicao', 'string', true, 'publico', 'Instituição do recebedor.'],
        ['realizado_em', 'datetime', true, 'interno', 'Data e hora.'],
        ['score_fraude', 'decimal', false, 'interno', 'Score do antifraude no momento do envio.'],
      ],
      addedInV2: ['score_fraude'], v2Note: 'Inclui o score do antifraude.',
      freshness: '1min', expectedVolume: '620 mil PIX por dia', faixa: ['valor', 'valor > 0'],
    }),
    contract(ctx, {
      id: 'fin-ct-contestacao', name: 'Contrato Contestação', domainId: D.contestacao, entity: 'Contestação', owner: u('engenheiro_dados'),
      fields: [
        ['contestacao_id', 'string', true, 'interno', 'Identificador.'],
        ['e2e_id', 'string', true, 'interno', 'Transação contestada.', 'Transação PIX.e2e_id'],
        ['tipo', 'string', true, 'interno', 'golpe, falha operacional ou engano do cliente.'],
        ['status', 'string', true, 'interno', 'aberta, em análise, devolvida ou negada.'],
        ['valor_recuperado', 'decimal', false, 'interno', 'Valor devolvido.'],
      ],
      addedInV2: ['valor_recuperado'], v2Note: 'Inclui valor recuperado.',
      freshness: '15min', expectedVolume: '1,4 mil contestações por dia',
    }),
    contract(ctx, {
      id: 'fin-ct-credito', name: 'Contrato Proposta de crédito', domainId: D.credito, entity: 'Proposta', owner: u('engenheiro_dados'),
      fields: [
        ['proposta_id', 'string', true, 'interno', 'Identificador.'],
        ['cliente_id', 'string', true, 'interno', 'Empresa.', 'Cliente.cliente_id'],
        ['valor_solicitado', 'decimal', true, 'interno', 'Valor pedido.'],
        ['rating', 'string', true, 'interno', 'Rating interno A a D.'],
        ['decisao', 'string', false, 'interno', 'pré-aprovada, comitê ou recusada.'],
        ['consentimento_of', 'string', false, 'interno', 'Consentimento Open Finance usado.'],
      ],
      addedInV2: ['consentimento_of'], v2Note: 'Registra o consentimento do Open Finance usado na análise.',
      freshness: '15min', expectedVolume: '900 propostas por dia', failing: true,
    }),
    contract(ctx, {
      id: 'fin-ct-conta', name: 'Contrato Conta', domainId: D.conta, entity: 'Conta', owner: u('engenheiro_dados'),
      fields: [
        ['conta', 'string', true, 'interno', 'Agência e conta.'],
        ['cliente_id', 'string', true, 'interno', 'Titular.', 'Cliente.cliente_id'],
        ['tipo', 'string', true, 'interno', 'corrente, pagamento ou PJ.'],
        ['saldo', 'decimal', true, 'sensivel', 'Saldo disponível.'],
        ['limite_pix_noturno', 'decimal', false, 'interno', 'Limite de PIX entre 20h e 6h.'],
      ],
      addedInV2: ['limite_pix_noturno'], v2Note: 'Inclui limite de PIX noturno.', versions: ['1.0.0', '1.1.0'],
      freshness: '5min', expectedVolume: '2,9 milhões de contas',
    }),
    contract(ctx, {
      id: 'fin-ct-cartao', name: 'Contrato Cartão', domainId: D.cartao, entity: 'Cartão', owner: u('engenheiro_dados'),
      fields: [
        ['cartao_id', 'string', true, 'interno', 'Identificador tokenizado.'],
        ['cliente_id', 'string', true, 'interno', 'Titular.', 'Cliente.cliente_id'],
        ['final', 'string', true, 'interno', 'Quatro últimos dígitos.'],
        ['status', 'string', true, 'interno', 'ativo, bloqueado preventivo ou cancelado.'],
        ['bloqueado_em', 'datetime', false, 'interno', 'Último bloqueio.'],
      ],
      addedInV2: ['bloqueado_em'], v2Note: 'Inclui data do último bloqueio.',
      freshness: '1min', expectedVolume: '3,1 milhões de cartões',
    }),
  ];

  const tables = [
    table(ctx, 'fin-tb-brz-pix', 'brz_pix_transacoes', 'bronze', D.transacao, 18700000, [['e2e_id', 'string', 'id:E2E'], ['pagador_cpf', 'string', 'cpf'], ['recebedor', 'string', 'nome'], ['valor', 'string', 'valor:5:9000'], ['recebido_em', 'timestamp', 'datahora:0:1']], 0),
    table(ctx, 'fin-tb-brz-clientes', 'brz_core_clientes', 'bronze', D.cliente, 2640000, [['cliente_id', 'string', 'id:CL-'], ['nome', 'string', 'nome'], ['cpf', 'string', 'cpf'], ['nascimento', 'date', 'nascimento'], ['kyc_raw', 'string', 'enum:OK|PEND']], 2),
    table(ctx, 'fin-tb-brz-propostas', 'brz_credito_propostas', 'bronze', D.credito, 284000, [['proposta_id', 'string', 'id:PP-'], ['cnpj', 'string', 'cnpj'], ['valor', 'string', 'valor:10000:900000'], ['payload_bureau', 'string', 'const:{...}']], 3),
    table(ctx, 'fin-tb-prt-pix', 'prt_pix_transacoes', 'prata', D.transacao, 18690000, [['e2e_id', 'string', 'id:E2E'], ['cliente_id', 'string', 'id:CL-'], ['recebedor_hash', 'string', 'hash'], ['valor', 'decimal', 'valor:5:9000'], ['score_fraude', 'decimal', 'pct:0:1']], 1),
    table(ctx, 'fin-tb-prt-clientes', 'prt_clientes', 'prata', D.cliente, 2638000, [['cliente_id', 'string', 'id:CL-'], ['nome_hash', 'string', 'hash'], ['cpf_hash', 'string', 'hash'], ['nivel_kyc', 'string', 'enum:completo|pendente'], ['segmento', 'string', 'enum:Lumen|Lumen Prime|PJ']], 2),
    table(ctx, 'fin-tb-prt-propostas', 'prt_propostas_pj', 'prata', D.credito, 283100, [['proposta_id', 'string', 'id:PP-'], ['cliente_id', 'string', 'id:CL-'], ['valor_solicitado', 'decimal', 'valor:10000:900000'], ['rating', 'string', 'enum:A|B|C|D']], 3),
    table(ctx, 'fin-tb-our-cliente', 'our_cliente_kyc', 'ouro', D.cliente, 2638000, [['cliente_id', 'string', 'id:CL-'], ['nivel_kyc', 'string', 'enum:completo|pendente'], ['segmento', 'string', 'enum:Lumen|Lumen Prime|PJ'], ['pep', 'boolean', 'bool:0.01'], ['tempo_relacionamento_meses', 'integer', 'int:1:96']], 3),
    table(ctx, 'fin-tb-our-pix', 'our_contestacoes_pix', 'ouro', D.transacao, 412000, [['contestacao_id', 'string', 'id:CTS-'], ['tipo', 'string', 'enum:golpe|falha_operacional|engano_cliente'], ['valor', 'decimal', 'valor:20:9000'], ['horas_ate_med', 'decimal', 'pct:0.2:72'], ['recuperado', 'boolean', 'bool:0.38']], 1),
    table(ctx, 'fin-tb-our-credito', 'our_carteira_credito_pj', 'ouro', D.credito, 61400, [['cliente_id', 'string', 'id:CL-'], ['rating', 'string', 'enum:A|B|C|D'], ['limite_aprovado', 'decimal', 'valor:20000:2000000'], ['inadimplencia_90d', 'boolean', 'bool:0.04']], 5),
  ];

  const sqlExamples = [
    { id: 'fin-sql-1', question: 'Quanto tempo leva, em média, entre a contestação e a abertura do MED por tipo?', sql: 'SELECT tipo, round(avg(horas_ate_med), 1) AS horas_medias, count(*) AS contestacoes\nFROM our_contestacoes_pix\nGROUP BY tipo\nORDER BY horas_medias DESC;', columns: ['tipo', 'horas_medias', 'contestacoes'], rows: [['falha_operacional', 31.4, 8120], ['golpe', 19.8, 36410], ['engano_cliente', 6.2, 14200]] },
    { id: 'fin-sql-2', question: 'Qual o percentual recuperado em golpes no último mês?', sql: "SELECT round(100.0 * avg(CASE WHEN recuperado THEN 1 ELSE 0 END), 1) AS pct_recuperado\nFROM our_contestacoes_pix\nWHERE tipo = 'golpe';", columns: ['pct_recuperado'], rows: [[38.2]] },
    { id: 'fin-sql-3', question: 'Como está a carteira PJ por rating?', sql: 'SELECT rating, count(*) AS empresas, sum(limite_aprovado) AS limite_total\nFROM our_carteira_credito_pj\nGROUP BY rating\nORDER BY rating;', columns: ['rating', 'empresas', 'limite_total'], rows: [['A', 14210, 2840000000], ['B', 26880, 3120000000], ['C', 15400, 980000000], ['D', 4910, 120000000]] },
  ];

  const collections = [
    { id: 'fin-col-politicas', name: 'Políticas internas', theme: 'Políticas', owner: u('dono_negocio'), domainId: D.credito, profiles: ['dono_negocio', 'champion', 'engenheiro_ai'], chunking: 'Por seção, até 400 tokens', embeddingModel: 'multilingual-e5-large' },
    { id: 'fin-col-regulacao', name: 'Normas aplicáveis (resumos internos)', theme: 'Regulamentação', owner: u('seguranca'), profiles: ['dono_negocio', 'champion', 'coe', 'seguranca'], chunking: 'Por norma resumida', embeddingModel: 'multilingual-e5-large' },
    { id: 'fin-col-atendimento', name: 'Atendimento e segurança', theme: 'Manuais', owner: u('champion'), domainId: D.contestacao, profiles: ['champion', 'engenheiro_ai', 'dono_negocio'], chunking: 'Por procedimento', embeddingModel: 'multilingual-e5-large' },
  ] as IndustryContent['collections'];

  const documents: IndustryContent['documents'] = [
    { id: 'fin-doc-med', collectionId: 'fin-col-atendimento', title: 'Manual interno do MED do PIX', version: '2.1', updatedAt: dateAgo(16), status: 'processado', chunks: [
      'O Mecanismo Especial de Devolução é usado quando há suspeita de golpe ou falha operacional em um PIX. Engano do próprio cliente não é coberto: nesse caso, orientamos o pedido de devolução ao recebedor.',
      'O Banco Lumen aceita contestações de golpe em até 30 dias após o PIX. Quanto antes o cliente avisar, maior a chance de encontrar saldo na conta recebedora.',
      'Ao abrir o MED, a instituição do recebedor pode bloquear cautelarmente o valor. A análise é concluída em até 7 dias e o cliente recebe o resultado pelo mesmo canal.',
      'Contestações acima de R$ 5 mil só são abertas após aprovação de um analista de fraude.',
      'Sempre informe o protocolo e recomende o registro de boletim de ocorrência em casos de golpe.',
    ] },
    { id: 'fin-doc-credito', collectionId: 'fin-col-politicas', title: 'Política de crédito PJ 2026', version: '2026.2', updatedAt: dateAgo(28), status: 'processado', chunks: [
      'Propostas só são analisadas com KYC completo da empresa e dos sócios.',
      'Empresas com rating A ou B e pedido até R$ 50 mil podem ser pré-aprovadas pelo gerente PJ.',
      'Pedidos acima de R$ 50 mil seguem para o comitê de crédito, que se reúne diariamente às 16h.',
      'Dados do Open Finance só podem ser usados com consentimento ativo e para a finalidade informada ao cliente.',
    ] },
    { id: 'fin-doc-normas', collectionId: 'fin-col-regulacao', title: 'Resumo interno de normas aplicáveis', version: '3.0', updatedAt: dateAgo(90), status: 'processado', chunks: [
      'Este resumo orienta as equipes do Banco Lumen e não substitui os textos oficiais do regulador e do conselho monetário.',
      'Toda concessão de crédito exige avaliação de capacidade de pagamento e registro da decisão.',
      'Clientes devem ser informados do custo efetivo total antes da contratação.',
    ] },
    { id: 'fin-doc-lgpd', collectionId: 'fin-col-regulacao', title: 'Guia LGPD do Banco Lumen', version: '1.8', updatedAt: dateAgo(50), status: 'processado', chunks: [
      'Dados pessoais só são tratados para a finalidade informada; renda e saldo são dados sensíveis para fins internos.',
      'Ambientes de homologação recebem apenas dados mascarados ou sintéticos.',
      'O cliente pode pedir acesso, correção e exclusão pelo app, com resposta em até 15 dias.',
    ] },
    { id: 'fin-doc-golpes', collectionId: 'fin-col-atendimento', title: 'Cartilha de golpes comuns', version: '1.3', updatedAt: dateAgo(12), status: 'processado', chunks: [
      'Falso vendedor: anúncio com preço muito abaixo do mercado e pedido de PIX para pessoa física.',
      'Falsa central: ligação pedindo para "regularizar" a conta com transferência ou código recebido por SMS.',
      'O Lumen nunca pede senha, código de verificação ou transferência para "conta segura".',
    ] },
  ];

  const retrievals = [
    { question: DEMO.showcaseQuestion, answer: 'O Banco Lumen aceita contestações de golpe em até 30 dias após o PIX. Quanto antes o aviso, maior a chance de encontrar saldo na conta recebedora; a análise do MED é concluída em até 7 dias.', results: [{ docId: 'fin-doc-med', chunkIndex: 1, score: 0.94 }, { docId: 'fin-doc-med', chunkIndex: 2, score: 0.83 }, { docId: 'fin-doc-med', chunkIndex: 0, score: 0.71 }] },
    { question: 'fiz um PIX errado para outra pessoa, posso usar o MED?', answer: 'Não. Engano do próprio cliente não é coberto pelo MED; a orientação é pedir a devolução diretamente ao recebedor.', results: [{ docId: 'fin-doc-med', chunkIndex: 0, score: 0.91 }] },
    { question: 'quem aprova crédito PJ acima de R$ 50 mil?', answer: 'O comitê de crédito, que se reúne diariamente às 16h. Até R$ 50 mil, com rating A ou B, o gerente PJ pode pré-aprovar.', results: [{ docId: 'fin-doc-credito', chunkIndex: 2, score: 0.93 }, { docId: 'fin-doc-credito', chunkIndex: 1, score: 0.84 }] },
  ];

  const knowledgeGraph: IndustryContent['knowledgeGraph'] = {
    nodes: [
      { id: 'fin-kg-cliente', label: 'Cliente', kind: 'entidade' },
      { id: 'fin-kg-pix', label: 'Transação PIX', kind: 'entidade' },
      { id: 'fin-kg-contestacao', label: 'Contestação', kind: 'entidade' },
      { id: 'fin-kg-proposta', label: 'Proposta de crédito', kind: 'entidade' },
      { id: 'fin-kg-consentimento', label: 'Consentimento Open Finance', kind: 'entidade' },
      { id: 'fin-tb-our-cliente', label: 'our_cliente_kyc', kind: 'tabela' },
      { id: 'fin-tb-our-pix', label: 'our_contestacoes_pix', kind: 'tabela' },
      { id: 'fin-tb-our-credito', label: 'our_carteira_credito_pj', kind: 'tabela' },
      { id: 'fin-doc-med', label: 'Manual interno do MED', kind: 'documento' },
      { id: 'fin-doc-credito', label: 'Política de crédito PJ 2026', kind: 'documento' },
      { id: 'fin-doc-golpes', label: 'Cartilha de golpes', kind: 'documento' },
      { id: 'fin-dt-med', label: 'MED do PIX', kind: 'regra' },
      { id: 'fin-dt-alcada', label: 'Alçada de crédito PJ', kind: 'regra' },
    ],
    edges: [
      { source: 'fin-kg-cliente', target: 'fin-kg-pix', label: 'envia' },
      { source: 'fin-kg-pix', target: 'fin-kg-contestacao', label: 'pode gerar' },
      { source: 'fin-kg-contestacao', target: 'fin-dt-med', label: 'triada por' },
      { source: 'fin-dt-med', target: 'fin-doc-med', label: 'origem' },
      { source: 'fin-kg-contestacao', target: 'fin-tb-our-pix', label: 'publicada em' },
      { source: 'fin-kg-contestacao', target: 'fin-doc-golpes', label: 'orientação' },
      { source: 'fin-kg-cliente', target: 'fin-tb-our-cliente', label: 'publicada em' },
      { source: 'fin-kg-cliente', target: 'fin-kg-proposta', label: 'solicita' },
      { source: 'fin-kg-proposta', target: 'fin-dt-alcada', label: 'decidida por' },
      { source: 'fin-dt-alcada', target: 'fin-doc-credito', label: 'origem' },
      { source: 'fin-kg-proposta', target: 'fin-kg-consentimento', label: 'usa' },
      { source: 'fin-kg-proposta', target: 'fin-tb-our-credito', label: 'publicada em' },
    ],
  };

  const artifacts: IndustryContent['artifacts'] = [
    { id: 'fin-art-okr-fraude', areaId: 'area-empresa', kind: 'OKR', title: 'Reduzir a perda por fraude para R$ 2,5 milhões por mês', summary: 'Perda líquida após devoluções do MED e chargebacks.', tags: ['okr', 'fraude'], metrics: [{ label: 'Atual', value: 'R$ 3,1 mi' }, { label: 'Meta', value: 'R$ 2,5 mi' }] },
    { id: 'fin-art-okr-pj', areaId: 'area-empresa', kind: 'OKR', title: 'Dobrar a carteira de crédito PJ', summary: 'Crescer com rating A e B mantendo inadimplência abaixo de 4%.', tags: ['okr', 'crédito'], metrics: [{ label: 'Atual', value: 'R$ 7,1 bi' }, { label: 'Meta', value: 'R$ 12 bi' }] },
    { id: 'fin-art-proc-contest', areaId: 'area-empresa', kind: 'Processo', title: 'Tratamento de contestação de PIX', summary: 'Aviso do cliente → triagem → MED → bloqueio cautelar → análise → devolução ou negativa.', tags: ['processo', 'pix'] },
    { id: 'fin-art-mkt-bench', areaId: 'area-mercado', kind: 'Ficha de mercado', title: 'Benchmark de atendimento a golpes', summary: 'Bancos digitais líderes abrem o MED em menos de 1 hora após o aviso; a média do mercado é de 20 horas.', body: 'Fonte: estudo setorial fictício para a demo, setembro de 2026.', tags: ['benchmark', 'golpe'], metrics: [{ label: 'Fonte', value: 'Estudo setorial' }, { label: 'Data', value: 'set/2026' }] },
    { id: 'fin-art-mkt-reg', areaId: 'area-mercado', kind: 'Ficha de regulação', title: 'Mecanismo Especial de Devolução', summary: 'Regras do arranjo PIX para devolução em caso de fraude ou falha operacional, com bloqueio cautelar.', body: 'Fonte: Manual interno do MED do PIX, versão 2.1. Origina a regra "MED do PIX".', tags: ['regulação', 'pix'], metrics: [{ label: 'Fonte', value: 'Manual interno 2.1' }, { label: 'Data', value: 'out/2026' }] },
    { id: 'fin-art-mkt-of', areaId: 'area-mercado', kind: 'Ficha de mercado', title: 'Uso de Open Finance no crédito PJ', summary: 'Concorrentes que usam dados compartilhados aprovam 18% mais PMEs com a mesma inadimplência.', tags: ['open finance', 'crédito'], metrics: [{ label: 'Fonte', value: 'Levantamento interno' }, { label: 'Data', value: 'ago/2026' }] },
    { id: 'fin-art-jor-golpe', areaId: 'area-jornadas', kind: 'Mapa de jornada', title: 'Vítima de golpe', summary: 'Etapas: golpe → percepção → aviso → contestação → resultado. Dor: demora entre aviso e abertura do MED.', tags: ['jornada', 'golpe'], metrics: [{ label: 'KPI', value: 'Tempo de contestação' }, { label: 'Canais', value: 'App, WhatsApp' }] },
    { id: 'fin-art-jor-credito', areaId: 'area-jornadas', kind: 'Mapa de jornada', title: 'Crédito PJ', summary: 'Etapas: necessidade → simulação → envio de dados → análise → contratação. Dor: pedido de documentos repetidos.', tags: ['jornada', 'crédito'] },
    { id: 'fin-art-jor-analista', areaId: 'area-jornadas', kind: 'Mapa de jornada', title: 'Rotina do analista de fraude', summary: 'Colaborador: fila de alertas → análise → decisão → registro. Dor: alertas sem contexto.', tags: ['jornada', 'colaborador'] },
    { id: 'fin-art-prd-giro', areaId: 'area-produtos', kind: 'Produto', title: 'Capital de giro Lumen PJ', summary: 'De R$ 10 mil a R$ 2 milhões, prazo de até 36 meses.', tags: ['crédito', 'pj'], metrics: [{ label: 'Taxa a partir de', value: '1,49% a.m.' }] },
    { id: 'fin-art-prd-conta', areaId: 'area-produtos', kind: 'Produto', title: 'Conta Lumen Prime', summary: 'Conta digital com cartão de crédito sem anuidade e limite de PIX noturno ajustável.', tags: ['conta', 'pf'] },
    { id: 'fin-art-prd-antecip', areaId: 'area-produtos', kind: 'Produto', title: 'Antecipação de recebíveis', summary: 'Antecipação de vendas no cartão para PMEs, com análise pelo Open Finance.', tags: ['crédito', 'pj'] },
    { id: 'fin-art-reg-med', areaId: 'area-regras', kind: 'Tabela de decisão', title: 'MED do PIX', summary: 'Ação, prazo e alçada da contestação por tipo de ocorrência, tempo e valor.', tags: ['regra', 'pix'], componentId: 'fin-cp-rule-med' },
    { id: 'fin-art-reg-alcada', areaId: 'area-regras', kind: 'Tabela de decisão', title: 'Alçada de crédito PJ', summary: 'Decisão e aprovador por valor, rating e KYC.', tags: ['regra', 'crédito'], componentId: 'fin-cp-rule-credito' },
    { id: 'fin-art-reg-guard', areaId: 'area-regras', kind: 'Guardrail', title: 'Movimentação financeira com aprovação humana acima da alçada', summary: 'Qualquer tool que movimenta dinheiro acima de R$ 5 mil exige aprovação humana.', tags: ['guardrail', 'alçada'], componentId: 'fin-cp-rule-alcada' },
  ];

  const decisionTables: DecisionTable[] = [
    {
      id: 'fin-dt-med', name: 'MED do PIX', domainId: D.contestacao, version: '2.0.0', componentId: 'fin-cp-rule-med',
      description: 'Triagem da contestação de PIX: ação, prazo de análise e alçada.',
      source: 'Manual interno do MED do PIX 2.1',
      inputs: [
        { key: 'tipo_ocorrencia', label: 'Tipo de ocorrência', type: 'enum', options: ['golpe', 'falha_operacional', 'engano_cliente'] },
        { key: 'horas_desde_pix', label: 'Horas desde o PIX', type: 'number' },
        { key: 'valor', label: 'Valor (R$)', type: 'number' },
      ],
      outputs: [{ key: 'acao', label: 'Ação' }, { key: 'prazo', label: 'Prazo de análise' }, { key: 'alcada', label: 'Alçada' }],
      rows: [
        { id: 'r1', conditions: { tipo_ocorrencia: '=engano_cliente', horas_desde_pix: '*', valor: '*' }, outputs: { acao: 'Orientar pedido de devolução ao recebedor (MED não se aplica)', prazo: '—', alcada: 'Agente' } },
        { id: 'r2', conditions: { tipo_ocorrencia: '=golpe', horas_desde_pix: '<=720', valor: '<=5000' }, outputs: { acao: 'Abrir MED com bloqueio cautelar', prazo: 'Até 7 dias', alcada: 'Agente' } },
        { id: 'r3', conditions: { tipo_ocorrencia: '=golpe', horas_desde_pix: '<=720', valor: '>5000' }, outputs: { acao: 'Abrir MED após aprovação do analista', prazo: 'Até 7 dias', alcada: 'Analista de fraude' } },
        { id: 'r4', conditions: { tipo_ocorrencia: '=golpe', horas_desde_pix: '>720', valor: '*' }, outputs: { acao: 'Fora do prazo interno: registrar e orientar boletim de ocorrência', prazo: '—', alcada: 'Atendente' } },
        { id: 'r5', conditions: { tipo_ocorrencia: '=falha_operacional', horas_desde_pix: '*', valor: '*' }, outputs: { acao: 'Abrir MED por falha operacional', prazo: '5 dias úteis', alcada: 'Agente' } },
      ],
      sampleCase: { tipo_ocorrencia: 'golpe', horas_desde_pix: 1.5, valor: 1850 },
    },
    {
      id: 'fin-dt-alcada', name: 'Alçada de crédito PJ', domainId: D.credito, version: '1.2.0', componentId: 'fin-cp-rule-credito',
      description: 'Decisão de pré-análise e aprovador por valor, rating e KYC.',
      source: 'Política de crédito PJ 2026',
      inputs: [
        { key: 'valor_solicitado', label: 'Valor solicitado (R$)', type: 'number' },
        { key: 'rating', label: 'Rating', type: 'enum', options: ['A', 'B', 'C', 'D'] },
        { key: 'kyc', label: 'KYC', type: 'enum', options: ['completo', 'pendente'] },
      ],
      outputs: [{ key: 'decisao', label: 'Decisão' }, { key: 'aprovador', label: 'Aprovador' }],
      rows: [
        { id: 'r1', conditions: { valor_solicitado: '*', rating: '*', kyc: '=pendente' }, outputs: { decisao: 'Suspender até completar o KYC', aprovador: 'Agente' } },
        { id: 'r2', conditions: { valor_solicitado: '<=50000', rating: 'A|B', kyc: '=completo' }, outputs: { decisao: 'Pré-aprovar', aprovador: 'Gerente PJ' } },
        { id: 'r3', conditions: { valor_solicitado: '>50000', rating: 'A|B', kyc: '=completo' }, outputs: { decisao: 'Encaminhar ao comitê de crédito', aprovador: 'Comitê de crédito' } },
        { id: 'r4', conditions: { valor_solicitado: '*', rating: 'C|D', kyc: '=completo' }, outputs: { decisao: 'Recusar com orientação de melhoria', aprovador: 'Agente' } },
      ],
      sampleCase: { valor_solicitado: 180000, rating: 'B', kyc: 'completo' },
    },
    {
      id: 'fin-dt-risco', name: 'Regras de risco de transação', domainId: D.transacao, version: '1.0.0',
      description: 'Ação automática diante de um alerta do antifraude.', source: 'Política de prevenção a fraudes',
      inputs: [{ key: 'score_fraude', label: 'Score de fraude', type: 'number' }, { key: 'dispositivo_novo', label: 'Dispositivo novo', type: 'boolean' }],
      outputs: [{ key: 'acao', label: 'Ação' }],
      rows: [
        { id: 'r1', conditions: { score_fraude: '>=0.9', dispositivo_novo: '*' }, outputs: { acao: 'Bloquear cartão e avisar o cliente' } },
        { id: 'r2', conditions: { score_fraude: '0.6..0.89', dispositivo_novo: '=true' }, outputs: { acao: 'Bloquear e pedir confirmação no app' } },
        { id: 'r3', conditions: { score_fraude: '0.6..0.89', dispositivo_novo: '=false' }, outputs: { acao: 'Pedir confirmação no app' } },
        { id: 'r4', conditions: { score_fraude: '<0.6', dispositivo_novo: '*' }, outputs: { acao: 'Liberar' } },
      ],
      sampleCase: { score_fraude: 0.93, dispositivo_novo: true },
    },
  ];

  const components: IndustryContent['components'] = [
    { id: 'fin-cp-agent-contestacao', type: 'agent', name: 'Agente de contestação PIX', version: '1.1.0', status: 'publicado_prd', domainId: D.contestacao, owner: 'champion',
      description: 'Acolhe a vítima, confirma a transação, aplica a regra do MED e abre a contestação dentro da alçada.',
      content: 'Papel: especialista em segurança do Banco Lumen.\nRegras: Regra do MED do PIX; Movimentação financeira com aprovação humana acima da alçada.\nSkills: Orientar vítima de golpe.\nTools: consultar_pix, sinais_de_fraude, abrir_med.\nTom: acolhedor e direto.',
      inputs: ['relato do cliente', 'transação', 'decisão da regra'], outputs: ['contestação aberta', 'orientações'],
      dependencies: ['fin-cp-rule-med', 'fin-cp-rule-alcada', 'fin-cp-skill-golpe'] },
    { id: 'fin-cp-rule-med', type: 'rule', name: 'Regra do MED do PIX', version: '2.0.0', status: 'publicado_prd', domainId: D.contestacao, owner: 'dono_negocio',
      description: 'Tabela de decisão "MED do PIX" publicada como componente Rule.',
      content: 'Fonte: tabela "MED do PIX" v2.0.0 (5 linhas).\nSaídas: acao, prazo, alcada.', inputs: ['tipo_ocorrencia', 'horas_desde_pix', 'valor'], outputs: ['acao', 'prazo', 'alcada'],
      log: [['1.0.0', 180, 'Versão inicial.'], ['2.0.0', 16, 'Separa a alçada acima de R$ 5 mil.']] },
    { id: 'fin-cp-rule-alcada', type: 'rule', name: 'Movimentação financeira com aprovação humana acima da alçada', version: '1.0.0', status: 'publicado_prd', owner: 'seguranca',
      description: 'Guardrail de destaque: tools que movimentam dinheiro acima de R$ 5 mil exigem aprovação humana.',
      content: 'SE tool.movimenta_dinheiro E valor > 5000\nENTAO exigir_aprovacao(perfil = analista) E registrar_auditoria', inputs: ['tool', 'valor'], outputs: ['liberação ou pedido de aprovação'] },
    { id: 'fin-cp-agent-credito', type: 'agent', name: 'Analista de crédito assistido', version: '1.4.0', status: 'publicado_prd', domainId: D.credito, owner: 'champion',
      description: 'Consolida cadastro, Open Finance e bureau e prepara o parecer para o aprovador da alçada.',
      content: 'Papel: analista de crédito PJ assistido.\nRegras: Política de crédito PJ.\nNunca decide sozinho: entrega parecer e recomendação.', inputs: ['proposta', 'dados da empresa'], outputs: ['parecer'], dependencies: ['fin-cp-rule-credito'] },
    { id: 'fin-cp-rule-credito', type: 'rule', name: 'Política de crédito PJ', version: '1.2.0', status: 'publicado_prd', domainId: D.credito, owner: 'dono_negocio',
      description: 'Tabela "Alçada de crédito PJ" publicada como componente Rule.', content: 'Fonte: tabela "Alçada de crédito PJ" v1.2.0 (4 linhas).', inputs: ['valor_solicitado', 'rating', 'kyc'], outputs: ['decisao', 'aprovador'] },
    { id: 'fin-cp-skill-golpe', type: 'skill', name: 'Orientar vítima de golpe', version: '1.0.0', status: 'homologado', domainId: D.contestacao, owner: 'engenheiro_ai',
      description: 'Orienta a vítima com passos práticos: boletim de ocorrência, troca de senhas e cuidados com novos contatos.',
      content: 'Instruções: acolha sem julgamento; informe o protocolo; recomende boletim de ocorrência; lembre que o banco nunca pede senha ou código.', inputs: ['tipo de golpe'], outputs: ['orientações'] },
    { id: 'fin-cp-doc-med', type: 'documento', name: 'Manual interno do MED', version: '2.1.0', status: 'homologado', owner: 'dono_negocio',
      description: 'Documento de referência versionado.', content: 'Documento: fin-doc-med (5 trechos).', inputs: [], outputs: ['trechos citáveis'] },
    { id: 'fin-cp-pacote-digital', type: 'pacote', name: 'Pacote Atendimento Digital 2.1', version: '2.1.0', status: 'homologado', domainId: D.contestacao, owner: 'champion', packageKind: 'jornada',
      description: 'Composição homologada para jornadas curtas de atendimento.',
      content: 'Componentes fixados:\n- Agente de contestação PIX 1.1.0\n- Regra do MED do PIX 2.0.0\n- Orientar vítima de golpe 1.0.0\n- Mascarar PII antes de enviar ao canal 1.3.0',
      inputs: [], outputs: ['plugin cortex-atendimento-digital@2.1.0'], dependencies: ['fin-cp-agent-contestacao', 'fin-cp-rule-med', 'fin-cp-skill-golpe', 'fin-cp-hook-pii'] },
    { id: 'fin-cp-pacote-alertas', type: 'pacote', name: 'Esteira de alertas antifraude', version: '0.6.0', status: 'em_revisao', domainId: D.transacao, owner: 'champion', packageKind: 'esteira',
      description: 'Esteira durável de tratamento de alertas.', content: 'Componentes fixados:\n- Registrar consentimento antes de contato ativo 0.3.0', inputs: [], outputs: ['plugin cortex-alertas@0.6.0'], dependencies: ['fin-cp-hook-consent'] },
  ];

  const journeys: IndustryContent['journeys'] = [
    {
      id: J.anchor, name: 'Contestação de PIX', anchor: true, type: 'agentica', domainId: D.contestacao, initiativeId: 'fin-in-01',
      description: 'O cliente avisa que caiu em golpe; a jornada confirma a transação, aplica o MED e abre a contestação no mesmo contato.',
      triggerLabel: 'Mensagem no app ou no WhatsApp', risk: 'supervisionada',
      brainInputs: ['Regras do MED', 'Transação', 'Sinais de fraude'],
      persona: { name: 'Lucas Prado · cliente Lumen', message: 'Caí num golpe! Fiz um PIX de R$ 1.850 para um vendedor falso agora há pouco. Como recupero?' },
      kpis: ['Tempo de contestação', 'Valor recuperado', 'Contestações sem atendente'],
      testCases: [
        ['Golpe abaixo da alçada', 'PIX de R$ 1.850 para vendedor falso há 1 hora', 'Abre MED com bloqueio cautelar e informa protocolo', 'passou'],
        ['Golpe acima da alçada', 'PIX de R$ 9.000 para falsa central', 'Pede aprovação do analista antes de abrir o MED', 'passou'],
        ['Engano do cliente', 'Mandei PIX para a pessoa errada', 'Orienta pedido de devolução ao recebedor', 'passou'],
      ],
      nodes: [
        { id: 'msg', kind: 'gatilho.mensagem', label: 'Mensagem do cliente', at: [0, 1], channelId: 'fin-ch-whatsapp', to: 'extrair',
          s: { in: 'Caí num golpe! Fiz um PIX de R$ 1.850 para um vendedor falso agora há pouco. Como recupero?', out: 'Mensagem de +55 21 9****-1180; cliente CL-7731045 autenticado.', ms: 45 } },
        { id: 'extrair', kind: 'agente.extrair', label: 'Extrair dados da contestação', at: [1, 1], to: 'transacao',
          s: { in: 'Relato do cliente', out: 'Tipo: golpe (falso vendedor); valor: R$ 1.850,00; quando: há cerca de 1h30.', tok: 520, ms: 690 } },
        { id: 'transacao', kind: 'dados.tool', label: 'Consultar transação PIX', at: [2, 1], toolId: 'fin-tl-consultar-pix', contractId: 'fin-ct-transacao', to: 'med',
          s: { in: 'cliente_id=CL-7731045, valor=1850, últimas 3 h', out: 'PIX E2E-90418822 de R$ 1.850,00 às 08h04 para conta em outra instituição; score de fraude 0,81; conta recebedora marcada como suspeita.', src: 'Contrato Transação PIX v2.0.0', ms: 380 } },
        { id: 'med', kind: 'logica.tabela', label: 'Regras do MED', at: [3, 1], ruleId: 'fin-dt-med', componentId: 'fin-cp-rule-med', to: 'agente',
          s: { in: 'tipo=golpe, horas_desde_pix=1,5, valor=R$ 1.850', out: 'Linha 2: abrir MED com bloqueio cautelar; análise em até 7 dias; alçada Agente.', rule: 'MED do PIX v2.0.0 · linha 2', src: 'Manual interno do MED do PIX 2.1', ms: 30 } },
        { id: 'agente', kind: 'agente.agente', label: 'Agente de contestação', at: [4, 1], componentId: 'fin-cp-agent-contestacao', to: 'cond',
          s: { in: 'Transação confirmada + decisão da regra', out: 'Confirma com o cliente a transação de R$ 1.850 e prepara a abertura do MED com bloqueio cautelar.', rule: 'Agente de contestação PIX 1.1.0', tok: 1290, ms: 1580 } },
        { id: 'cond', kind: 'logica.condicao', label: 'Valor acima da alçada?', at: [5, 1], to: { sim: 'aprovacao', 'não': 'abrir' },
          s: { in: 'valor R$ 1.850 > alçada R$ 5.000?', out: 'não', rule: 'Movimentação financeira com aprovação humana acima da alçada 1.0.0', ms: 10, take: 'não' } },
        { id: 'aprovacao', kind: 'pessoas.aprovacao', label: 'Aprovação do analista', at: [6, 0], to: { aprovado: 'abrir', reprovado: 'transbordo' },
          s: { in: 'Pedido de MED acima da alçada', out: 'Aprovado pelo analista de fraude.', ms: 900, take: 'aprovado' } },
        { id: 'transbordo', kind: 'pessoas.transbordo', label: 'Transbordo para analista', at: [7, 0], componentId: 'fin-cp-skill-resumo',
          s: { in: 'Caso reprovado', out: 'Conversa enviada à fila de fraude com resumo.', ms: 120 } },
        { id: 'abrir', kind: 'dados.tool', label: 'Abrir MED no PIX', at: [7, 1], toolId: 'fin-tl-abrir-med', contractId: 'fin-ct-contestacao', emitsPii: true, to: 'responder',
          s: { in: 'e2e_id=E2E-90418822, motivo=fraude', out: 'MED-2210487 aberto para Lucas Prado, CPF 409.736.251-80, conta 0001-7731045-2; R$ 1.850,00 bloqueados cautelarmente na conta recebedora.', src: 'Contrato Contestação v2.0.0', ms: 1120 } },
        { id: 'responder', kind: 'saida.responder', label: 'Responder no canal', at: [8, 1], channelId: 'fin-ch-whatsapp',
          s: { in: 'Protocolo do MED + orientações', out: 'Lucas, abrimos a contestação MED-2210487 e o valor de R$ 1.850 foi bloqueado na conta de destino. A análise termina em até 7 dias e você recebe o resultado por aqui. Recomendamos registrar um boletim de ocorrência.', ms: 250 } },
      ],
      versions: [
        { version: '0.1.0', daysAgo: 7, author: 'champion', note: 'Rascunho gerado por /cortex:desenhar a partir da iniciativa.', drop: ['cond', 'aprovacao', 'transbordo'] },
        { version: '0.2.0', daysAgo: 1, author: 'engenheiro_ai', note: 'Inclui alçada de R$ 5 mil com aprovação humana.' },
      ],
      envVersions: { dev: '0.2.0', hml: null, prd: null },
      piiFilter: { in: 'Saída de "Abrir MED no PIX" com nome completo, CPF e número da conta', out: 'MED-2210487 aberto para Lucas, CPF ***.736.251-**, conta ****045-2; R$ 1.850,00 bloqueados cautelarmente.' },
    },
    {
      id: J.prd, name: 'Pré-análise de crédito PJ', type: 'agentica', domainId: D.credito, initiativeId: 'fin-in-05',
      description: 'A empresa pede crédito no internet banking; o agente consolida cadastro, Open Finance e bureau e envia o parecer para a alçada humana.',
      triggerLabel: 'Pedido no internet banking', risk: 'assistida',
      brainInputs: ['Política de crédito', 'Bureau', 'Open Finance'],
      persona: { name: 'Débora Costa · Costa Distribuidora Ltda', message: 'Preciso de R$ 180 mil de capital de giro para a safra de fim de ano.' },
      kpis: ['Tempo de resposta ao crédito', 'Aprovação PJ', 'Inadimplência 90 dias'],
      testCases: [
        ['Pedido acima de R$ 50 mil', 'R$ 180 mil, rating B', 'Encaminha ao comitê com parecer', 'passou'],
        ['KYC pendente', 'R$ 30 mil com KYC pendente', 'Suspende e pede documentos', 'passou'],
        ['Rating D', 'R$ 20 mil, rating D', 'Recusa com orientação', 'passou'],
      ],
      nodes: [
        { id: 'pedido', kind: 'gatilho.mensagem', label: 'Pedido de crédito', at: [0, 1], channelId: 'fin-ch-ib', to: 'cliente',
          s: { in: 'Preciso de R$ 180 mil de capital de giro para a safra de fim de ano.', out: 'Proposta PP-660215 criada para Costa Distribuidora Ltda.', ms: 50 } },
        { id: 'cliente', kind: 'dados.produto', label: 'Ler cadastro e KYC', at: [1, 1], contractId: 'fin-ct-cliente', emitsPii: true, to: 'openf',
          s: { in: 'cliente_id=CL-3301877', out: 'KYC completo (empresa e 2 sócios); faturamento anual R$ 4,2 milhões; cliente há 41 meses.', src: 'Contrato Cliente v2.0.0', ms: 170 } },
        { id: 'openf', kind: 'dados.tool', label: 'Dados do Open Finance', at: [2, 1], toolId: 'fin-tl-of-dados', to: 'bureau',
          s: { in: 'consentimento urn:lumen:88120 (operações de crédito)', out: '2 operações em outras instituições; saldo devedor de R$ 96 mil, em dia.', ms: 820 } },
        { id: 'bureau', kind: 'dados.tool', label: 'Consultar bureau', at: [3, 1], toolId: 'fin-tl-bureau', to: 'politica',
          s: { in: 'cnpj da empresa', out: 'Score 812, rating B, sem restrições.', ms: 1350 } },
        { id: 'politica', kind: 'logica.tabela', label: 'Política de crédito PJ', at: [4, 1], ruleId: 'fin-dt-alcada', componentId: 'fin-cp-rule-credito', to: 'agente',
          s: { in: 'valor=R$ 180 mil, rating=B, kyc=completo', out: 'Linha 3: encaminhar ao comitê de crédito.', rule: 'Alçada de crédito PJ v1.2.0 · linha 3', src: 'Política de crédito PJ 2026', ms: 30 } },
        { id: 'agente', kind: 'agente.agente', label: 'Analista de crédito assistido', at: [5, 1], componentId: 'fin-cp-agent-credito', to: 'aprovacao',
          s: { in: 'Cadastro + Open Finance + bureau + decisão da regra', out: 'Parecer: capacidade de pagamento compatível com R$ 180 mil em 24 meses; recomenda aprovação com garantia de recebíveis.', tok: 1820, ms: 1760 } },
        { id: 'aprovacao', kind: 'pessoas.aprovacao', label: 'Aprovação na alçada', at: [6, 1], to: { aprovado: 'pii', reprovado: 'tarefa' },
          s: { in: 'Parecer para o comitê', out: 'Comitê aprovou com garantia de recebíveis.', ms: 1200, take: 'aprovado' } },
        { id: 'pii', kind: 'guardrail.pii', label: 'Filtro de PII', at: [7, 0], componentId: 'fin-cp-hook-pii', to: 'responder',
          s: { in: 'Resposta com nomes dos sócios e faturamento', out: 'Nomes dos sócios e faturamento removidos da mensagem.', rule: 'Mascarar PII antes de enviar ao canal 1.3.0', ms: 35 } },
        { id: 'responder', kind: 'saida.responder', label: 'Responder no canal', at: [8, 0], channelId: 'fin-ch-ib',
          s: { in: 'Decisão aprovada', out: 'Débora, seu crédito de R$ 180 mil foi aprovado com garantia de recebíveis. Confira as condições e o custo efetivo total para contratar.', ms: 220 } },
        { id: 'tarefa', kind: 'pessoas.tarefa', label: 'Tarefa para o gerente PJ', at: [7, 2],
          s: { in: 'Proposta recusada', out: 'Tarefa criada para o gerente PJ entrar em contato.', ms: 140 } },
      ],
      versions: [
        { version: '1.0.0', daysAgo: 100, author: 'champion', note: 'Primeira versão em produção.', drop: ['openf', 'agente'] },
        { version: '1.1.0', daysAgo: 36, author: 'engenheiro_ai', note: 'Parecer preparado pelo analista assistido.', drop: ['openf'] },
        { version: '1.2.0', daysAgo: 3, author: 'engenheiro_ai', note: 'Inclui dados do Open Finance com consentimento.' },
      ],
      envVersions: { dev: '1.2.0', hml: '1.2.0', prd: '1.1.0' },
    },
    {
      id: J.auto, name: 'Alerta de transação atípica', type: 'automacao', domainId: D.transacao, initiativeId: 'fin-in-04',
      description: 'Automação sem agente: recebe o alerta do antifraude, aplica as regras de risco e bloqueia ou pede confirmação.',
      triggerLabel: 'Evento do antifraude', risk: 'autonoma',
      brainInputs: ['Regras de risco', 'Preferência de canal'],
      persona: { name: 'Evento do antifraude', message: 'Alerta AF-5518230: compra de R$ 2.400 em dispositivo novo, score 0,93.' },
      kpis: ['Perda por fraude', 'Falsos positivos'],
      testCases: [
        ['Score alto', 'Score 0,93 em dispositivo novo', 'Bloqueia o cartão e avisa no app', 'passou'],
        ['Score baixo', 'Score 0,3', 'Libera sem contato', 'passou'],
      ],
      nodes: [
        { id: 'evento', kind: 'gatilho.evento', label: 'Alerta do antifraude', at: [0, 0], to: 'risco',
          s: { in: '{"alerta":"AF-5518230","score":0.93,"valor":2400,"dispositivo_novo":true}', out: 'Alerta recebido do tópico antifraude.alertas.v3.', ms: 15 } },
        { id: 'risco', kind: 'logica.tabela', label: 'Regras de risco', at: [1, 0], ruleId: 'fin-dt-risco', to: 'cond',
          s: { in: 'score_fraude=0,93, dispositivo_novo=sim', out: 'Linha 1: bloquear cartão e avisar o cliente.', rule: 'Regras de risco de transação v1.0.0 · linha 1', ms: 15 } },
        { id: 'cond', kind: 'logica.condicao', label: 'Exige bloqueio?', at: [2, 0], to: { sim: 'bloquear', 'não': 'fim' },
          s: { in: 'acao = Bloquear cartão e avisar o cliente', out: 'sim', ms: 10, take: 'sim' } },
        { id: 'bloquear', kind: 'dados.tool', label: 'Bloquear cartão', at: [3, 0], toolId: 'fin-tl-bloquear-cartao', to: 'notificar',
          s: { in: 'cartão final 4471', out: 'Cartão bloqueado preventivamente.', ms: 260 } },
        { id: 'notificar', kind: 'saida.notificar', label: 'Avisar no app', at: [4, 0], channelId: 'fin-ch-app', to: 'esperar',
          s: { in: 'Alerta de segurança', out: 'Push enviado: "Bloqueamos seu cartão final 4471 por segurança. Foi você?"', ms: 180 } },
        { id: 'esperar', kind: 'logica.esperar', label: 'Aguardar confirmação (15 min)', at: [5, 0], to: 'fim',
          s: { in: 'Janela de 15 minutos', out: 'Cliente respondeu "Não fui eu" (simulado).', ms: 20 } },
        { id: 'fim', kind: 'saida.encerrar', label: 'Encerrar', at: [6, 0], s: { in: 'Fluxo concluído', out: 'Encerrado.', ms: 5 } },
      ],
      versions: [
        { version: '0.9.0', daysAgo: 19, author: 'engenheiro_ai', note: 'Bloqueio por limiar fixo de score.', drop: ['risco'] },
        { version: '1.0.0', daysAgo: 5, author: 'engenheiro_ai', note: 'Ação vem das regras de risco do cérebro.' },
      ],
      envVersions: { dev: '1.0.0', hml: '1.0.0', prd: null },
    },
  ];

  const initiatives: IndustryContent['initiatives'] = [
    {
      id: 'fin-in-01', title: 'Cliente contesta PIX de golpe pelo WhatsApp com MED no mesmo contato', type: 'nova_jornada', domainId: D.contestacao, owner: u('dono_negocio'),
      stage: 'ideia', expectedValueBRL: 6200000, health: 'ok', journeyId: J.anchor,
      problem: 'Entre o aviso do golpe e a abertura do MED passam 72 horas em média; quanto maior a demora, menor a recuperação.',
      objective: 'Abrir o MED no mesmo contato, dentro da alçada, com bloqueio cautelar imediato.',
      metric: 'Tempo de contestação de 72 h para 12 h',
      validation: {
        checks: [
          { key: 'estrategia', label: 'Estratégia', result: 'verde', summary: 'Move o OKR "Reduzir a perda por fraude para R$ 2,5 milhões por mês".', source: 'Empresa · OKRs 2026' },
          { key: 'mercado', label: 'Mercado e regulação', result: 'verde', summary: 'Líderes abrem o MED em menos de 1 hora. Regras do MED refletidas na tabela de decisão.', source: 'Mercado · Benchmark de atendimento a golpes (set/2026)' },
          { key: 'regras', label: 'Regras de negócio', result: 'verde', summary: 'Usa "MED do PIX" v2.0.0 e o guardrail de alçada de R$ 5 mil.', source: 'Regras de negócio' },
          { key: 'dados', label: 'Dados', result: 'amarelo', summary: 'Contratos Transação PIX e Contestação publicados. Lacuna de dado: a marcação de conta suspeita não chega estruturada da outra instituição.', source: 'Dados · Contrato Transação PIX' },
          { key: 'integracoes', label: 'Integrações e canais', result: 'verde', summary: 'PIX, antifraude e core conectados; WhatsApp configurado sem jornada vinculada.', source: 'Conectores e Canais' },
          { key: 'arquitetura', label: 'Arquitetura', result: 'verde', summary: 'Padrão "Agente com recuperação e tools", com aprovação humana acima da alçada.', source: 'Arquitetura · referências' },
          { key: 'reuso', label: 'Reuso', result: 'verde', summary: '70% de reuso: Agente de contestação PIX, Regra do MED, Orientar vítima de golpe, guardrail de alçada e Mascarar PII.', source: 'Catálogo · Pacote Atendimento Digital 2.1' },
          { key: 'business_case', label: 'Business case', result: 'vermelho', summary: 'Premissa de recuperação de 45% ainda sem histórico próprio; valor de R$ 6,2 milhões por ano depende dessa taxa.', source: 'Telemetria · contestações PIX' },
        ],
        recommendation: 'O cérebro indica seguir como jornada agêntica supervisionada, com aprovação humana acima de R$ 5 mil. Recomendamos avaliar a premissa de recuperação com o histórico dos próximos 60 dias.',
        attention: ['Lacuna de dado: marcação de conta suspeita não estruturada', 'Premissa de recuperação sem histórico', 'Dado pessoal chega ao WhatsApp: exigir filtro de PII'],
        reusePct: 70, solutionType: 'agente',
      },
    },
    { id: 'fin-in-02', title: 'Renegociação de dívida pelo app', type: 'nova_jornada', domainId: D.credito, owner: u('dono_negocio'), stage: 'ideia', expectedValueBRL: 2800000, health: 'ok',
      problem: 'Clientes em atraso não encontram proposta de acordo no app.', objective: 'Proposta de renegociação dentro da política, sem atendente.', metric: 'Recuperação de atrasos: +25%' },
    { id: 'fin-in-03', title: 'Limite de PIX noturno inteligente', type: 'eficiencia', domainId: D.conta, owner: u('dono_negocio'), stage: 'validacao', expectedValueBRL: 1400000, health: 'atencao',
      problem: 'Golpes noturnos concentram 31% das perdas.', objective: 'Ajuste automático do limite pelo comportamento.', metric: 'Perda noturna: -40%' },
    { id: 'fin-in-04', title: 'Alerta de transação atípica', type: 'eficiencia', domainId: D.transacao, owner: u('champion'), stage: 'construcao', expectedValueBRL: 3900000, health: 'ok', journeyId: J.auto,
      problem: 'Alertas do antifraude ficam em fila manual.', objective: 'Tratar alertas automaticamente pelas regras de risco.', metric: 'Perda por fraude com cartão: -30%',
      validation: okValidation('O cérebro indica seguir como automação sem agente.', [], 48, 'automacao') },
    { id: 'fin-in-05', title: 'Pré-análise de crédito PJ', type: 'agente_ia', domainId: D.credito, owner: u('dono_negocio'), stage: 'operacao', expectedValueBRL: 8400000, health: 'ok', journeyId: J.prd,
      problem: 'Resposta ao crédito PJ levava 9 dias.', objective: 'Parecer em minutos para a alçada humana.', metric: 'Tempo de resposta de 9 dias para 1 dia',
      validation: okValidation('O cérebro indica seguir com decisão sempre humana.', ['Bureau com latência degradada'], 55, 'agente') },
    { id: 'fin-in-06', title: 'Onboarding PJ com documentos pelo WhatsApp', type: 'nova_jornada', domainId: D.cliente, owner: u('champion'), stage: 'prototipo', expectedValueBRL: 1700000, health: 'ok',
      problem: 'Abertura de conta PJ leva 5 dias.', objective: 'Coleta e conferência de documentos por agente.', metric: 'Abertura PJ de 5 para 1 dia' },
    { id: 'fin-in-07', title: 'Assistente interno de normas para compliance', type: 'agente_ia', domainId: D.cliente, owner: u('champion'), stage: 'prototipo', expectedValueBRL: 600000, health: 'atencao',
      problem: 'Consultas a normas tomam horas do time de compliance.', objective: 'Assistente que cita o resumo interno vigente.', metric: 'Tempo de consulta: -70%' },
    { id: 'fin-in-08', title: 'Modernização do core de cartões', type: 'modernizacao', domainId: D.cartao, owner: u('champion'), stage: 'construcao', expectedValueBRL: 5200000, health: 'risco',
      problem: 'Core de cartões legado sem eventos em tempo real.', objective: 'Eventos de cartão no Kafka para jornadas.', metric: 'Latência de bloqueio de 40 s para 2 s' },
    { id: 'fin-in-09', title: 'Antecipação de recebíveis com Open Finance', type: 'novo_produto', domainId: D.credito, owner: u('dono_negocio'), stage: 'validacao', expectedValueBRL: 4600000, health: 'ok',
      problem: 'PMEs buscam antecipação fora do banco.', objective: 'Oferta pré-aprovada a partir de dados compartilhados.', metric: 'Carteira de antecipação: +R$ 300 milhões' },
  ];

  const policies: IndustryContent['policies'] = [
    { id: 'fin-pol-alcada', name: 'Jornada que movimenta dinheiro exige aprovação humana acima de R$ 5 mil', kind: 'jornada', description: 'Qualquer tool que devolve, transfere ou bloqueia valores acima de R$ 5 mil precisa de aprovação de um analista.', condition: 'quando uma tool que movimenta dinheiro receber valor acima de R$ 5.000', effect: 'exigir_aprovacao', envs: ['hml', 'prd'], active: true,
      code: JSON.stringify({ policy: 'alcada-5mil', when: { tool: { movimentaDinheiro: true }, input: { valor: { gt: 5000 } } }, then: { exigir_aprovacao: ['dono_negocio'] } }, null, 2) },
    { id: 'fin-pol-consentimento', name: 'Dados do Open Finance só com consentimento ativo', kind: 'dado', description: 'Nenhum nó lê dados compartilhados sem consentimento válido e com a finalidade correspondente.', condition: 'quando a tool dados_open_finance for chamada sem consentimento ativo', effect: 'bloquear', envs: ['dev', 'hml', 'prd'], active: true,
      code: JSON.stringify({ policy: 'of-consentimento', when: { tool: 'dados_open_finance', consent: { active: false } }, then: 'bloquear' }, null, 2) },
  ];

  return {
    workspace: { id: 'ws-financeiro', industry: 'financeiro', company: 'Banco Lumen', segment: 'Banco digital', tagline: 'Banco digital para pessoas e pequenas empresas',
      description: 'Banco digital fictício com 2,6 milhões de clientes PF e 182 mil empresas. Atende por app, WhatsApp, internet banking e backoffice.' },
    userDomains: { dono_negocio: [D.contestacao, D.credito, D.cliente], champion: [D.cliente, D.conta, D.transacao, D.credito, D.cartao, D.contestacao], engenheiro_ai: [D.contestacao, D.credito], engenheiro_dados: Object.values(D), seguranca: [D.cliente, D.transacao], patrocinador: [D.credito] },
    systems, connectors, channels, domains, contracts, tables, sqlExamples,
    lineage: [
      ['fin-con-pix', 'fin-tb-brz-pix'], ['fin-con-core', 'fin-tb-brz-clientes'],
      ['fin-tb-brz-pix', 'fin-tb-prt-pix'], ['fin-tb-brz-clientes', 'fin-tb-prt-clientes'],
      ['fin-tb-prt-pix', 'fin-tb-our-pix'], ['fin-tb-prt-clientes', 'fin-tb-our-cliente'],
      ['fin-tb-our-pix', 'fin-ct-transacao'], ['fin-tb-our-cliente', 'fin-ct-cliente'],
      ['fin-ct-transacao', J.anchor], ['fin-ct-cliente', J.prd], ['fin-ct-cliente', J.anchor],
      [J.prd, 'fin-ch-ib'], [J.anchor, 'fin-ch-whatsapp'],
    ],
    collections, documents, retrievals, knowledgeGraph,
    coverage: [76, 59, 63, 72, 88, 69, 75, 64, 47, 83],
    artifacts, decisionTables, components, journeys, initiatives, policies,
    kpis: [
      { name: 'Tempo de contestação', unit: 'h', baseline: 72, current: 20, target: 12, better: 'down' },
      { name: 'Perda por fraude', unit: 'R$ milhões/mês', baseline: 4.8, current: 3.1, target: 2.5, better: 'down' },
      { name: 'Custo por atendimento', unit: 'R$', baseline: 9.4, current: 5.2, target: 4, better: 'down' },
      { name: 'NPS', unit: 'pontos', baseline: 47, current: 61, target: 70, better: 'up' },
    ],
    guardrail: { text: 'Movimentação financeira acima da alçada sem aprovação humana', nodeId: 'agente' },
    dailyVolume: 9600,
    suggestions: ({ journeys: js }) => {
      const prdJ = js.find((j) => j.id === J.prd)!;
      return [
        { id: 'fin-sg-1', kind: 'skill', title: 'Criar skill "Explicar custo efetivo total"', status: 'nova', journeyId: J.prd, sourceDocId: 'fin-doc-credito',
          evidence: `32% dos transbordos da jornada ${prdJ.name} ocorrem na mesma pergunta ("qual o custo total do empréstimo?"); criar skill a partir do documento Política de crédito PJ 2026?`,
          proposal: 'Skill que explica o custo efetivo total da proposta em linguagem simples, com parcelas e encargos.' },
        { id: 'fin-sg-2', kind: 'regra', title: 'Linha para golpe de falsa central', status: 'nova', journeyId: J.anchor, sourceDocId: 'fin-doc-golpes',
          evidence: '26% dos testes de contestação citam falsa central e caem em perguntas extras de triagem.',
          proposal: 'Adicionar "falsa central" como subtipo de golpe na tabela MED do PIX, com orientação específica da cartilha.' },
        { id: 'fin-sg-3', kind: 'skill', title: 'Skill de explicação de bloqueio preventivo', status: 'descartada', journeyId: J.auto, sourceDocId: 'fin-doc-golpes',
          evidence: '12% dos clientes bloqueados ligam para entender o motivo.', proposal: 'Skill que explica o bloqueio e como desbloquear pelo app.' },
      ];
    },
  };
}
