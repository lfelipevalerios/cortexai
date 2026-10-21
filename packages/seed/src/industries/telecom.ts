// Onda Telecom: operadora fixa e móvel (empresa fictícia).
import type { IndustryContent, IndustryMeta, Ctx } from '../common';
import { connector, contract, obj, table, ts, dateAgo } from '../common';

const W = 'tel';
export const meta: IndustryMeta = {
  industry: 'telecom', p: W, ws: 'ws-telecom', seed: 0x7e1ec0,
  people: {
    patrocinador: 'Helena Duarte', dono_negocio: 'Rodrigo Siqueira', champion: 'Camila Rezende', engenheiro_ai: 'Thiago Nogueira',
    engenheiro_dados: 'Larissa Queiroz', coe: 'Otávio Lacerda', seguranca: 'Patrícia Moreira', admin: 'Felipe Carvalho',
  },
  coreName: 'Billing BSS', coreConnectorId: 'tel-con-billing', org: 'onda-telecom', repo: 'jornadas-atendimento-pme',
};

export const DEMO = {
  anchorJourneyId: 'tel-jr-segunda-via', prdJourneyId: 'tel-jr-retencao', anchorInitiativeId: 'tel-in-01',
  whatsappChannelId: 'tel-ch-whatsapp', showcaseDecisionTableId: 'tel-dt-contestacao',
  showcaseQuestion: 'qual o prazo para resolver uma contestação de fatura de cliente PME?', crmSystemId: 'tel-sys-crm',
};
export const BREAKING = { contractId: 'tel-ct-cliente', field: 'segmento' };

export function crmPreset(ctx: Ctx) {
  return {
    typeId: 'salesforce', name: 'BSS · CRM (Salesforce)', domainId: 'tel-dom-cliente',
    endpoint: 'https://ondatelecom.my.salesforce.example/services/data/v61.0',
    objects: [
      obj(ctx, 'Conta (Account)', 'objeto', 48210, [['id', 'string', 'id:001A'], ['razao_social', 'string', 'empresa'], ['cnpj', 'string', 'cnpj'], ['segmento', 'string', 'enum:PME|PME|Corporativo'], ['uf', 'string', 'uf']]),
      obj(ctx, 'Contato (Contact)', 'objeto', 131540, [['id', 'string', 'id:003B'], ['nome', 'string', 'nome'], ['cpf', 'string', 'cpf'], ['email', 'string', 'email'], ['telefone', 'string', 'telefone'], ['cargo', 'string', 'enum:Sócio|Financeiro|Administrativo']],
        { row0: { nome: 'Juliana P****', cpf: '***.482.913-**', telefone: '(11) 9****-4821' } }),
      obj(ctx, 'Caso (Case)', 'objeto', 812430, [['id', 'string', 'id:500C'], ['contato_id', 'string', 'id:003B'], ['assunto', 'string', 'enum:Fatura|Cancelamento|Sem sinal|Portabilidade'], ['status', 'string', 'enum:Aberto|Fechado|Em análise'], ['criado_em', 'datetime', 'datahora:0:60']]),
    ],
    tools: [
      { id: 'tel-tl-crm-consultar-cliente', name: 'consultar_cliente', description: 'Busca conta e contatos pelo CNPJ ou telefone.', mode: 'leitura' as const, enabledByEnv: { dev: true, hml: true, prd: true } },
      { id: 'tel-tl-crm-historico', name: 'listar_casos_do_cliente', description: 'Lista os últimos casos de atendimento do cliente.', mode: 'leitura' as const, enabledByEnv: { dev: true, hml: true, prd: true } },
      { id: 'tel-tl-crm-atualizar-contato', name: 'atualizar_contato', description: 'Atualiza e-mail e telefone do contato.', mode: 'escrita' as const, enabledByEnv: { dev: true, hml: true, prd: false } },
    ],
  };
}

export function build(ctx: Ctx): IndustryContent {
  const u = ctx.u;
  const D = {
    cliente: 'tel-dom-cliente', contrato: 'tel-dom-contrato', fatura: 'tel-dom-fatura', os: 'tel-dom-os',
    rede: 'tel-dom-rede', oferta: 'tel-dom-oferta', eventos: 'tel-dom-eventos', logs: 'tel-dom-logs',
  };
  const J = { anchor: 'tel-jr-segunda-via', prd: 'tel-jr-retencao', auto: 'tel-jr-diagnostico' };

  const connectors = [
    connector(ctx, {
      id: 'tel-con-billing', typeId: 'tmforum', name: 'Billing BSS · TMF Open APIs', domainId: D.fatura, syncMode: 'cdc',
      volume: 1284000, latencyMs: 310, consumers: [J.anchor, 'tel-ct-fatura', 'tel-ct-cliente'],
      endpoint: 'https://billing-{env}.ondatelecom.example/tmf-api/customerBillManagement/v4',
      objects: [
        obj(ctx, 'customerBill (Fatura)', 'endpoint', 1284000, [['fatura_id', 'string', 'id:FT-2026-'], ['cliente_id', 'string', 'id:CLI-'], ['competencia', 'string', 'enum:2026-08|2026-09|2026-10'], ['valor_total', 'decimal', 'valor:79:1890'], ['vencimento', 'date', 'data:0:20'], ['status', 'string', 'enum:aberta|paga|vencida']]),
        obj(ctx, 'billingAccount (Conta de cobrança)', 'endpoint', 412300, [['conta_id', 'string', 'id:BA-'], ['titular', 'string', 'nome'], ['cpf_cnpj', 'string', 'cpf'], ['email', 'string', 'email'], ['telefone', 'string', 'telefone'], ['endereco_cobranca', 'string', 'endereco']],
          { row0: { titular: 'Juliana P****', cpf_cnpj: '***.482.913-**', telefone: '(11) 9****-4821' } }),
        obj(ctx, 'appliedCustomerBillingRate (Item de fatura)', 'endpoint', 9870000, [['item_id', 'string', 'id:IT-'], ['fatura_id', 'string', 'id:FT-2026-'], ['descricao', 'string', 'enum:Plano PME Conecta|Pacote de dados 10 GB|Roaming nacional|Voz ilimitada'], ['valor', 'decimal', 'valor:9.9:349'], ['contratado', 'boolean', 'bool:0.92']]),
      ],
      tools: [
        ['tel-tl-consultar-fatura', 'consultar_fatura', 'Retorna a fatura da competência com itens, valor e vencimento.', 'leitura'],
        ['tel-tl-segunda-via', 'gerar_segunda_via', 'Gera PDF e linha digitável da segunda via.', 'leitura'],
        ['tel-tl-abrir-contestacao', 'abrir_contestacao', 'Registra contestação de item da fatura com motivo e valor.', 'escrita', 'tel-pol-contestacao'],
      ],
    }),
    connector(ctx, {
      id: 'tel-con-oss', typeId: 'postgresql', name: 'OSS · Inventário e ativação', domainId: D.rede, syncMode: 'cdc',
      volume: 3650000, latencyMs: 95, consumers: [J.auto, 'tel-ct-rede'],
      endpoint: 'postgresql://oss-{env}.ondatelecom.example:5432/inventario',
      objects: [
        obj(ctx, 'rede.celula', 'tabela', 18420, [['celula_id', 'string', 'id:CEL-'], ['regiao', 'string', 'cidade'], ['tecnologia', 'string', 'enum:4G|5G|FTTH'], ['status', 'string', 'enum:operando|operando|degradada|falha'], ['atualizado_em', 'timestamp', 'datahora:0:1']]),
        obj(ctx, 'ativacao.ordem', 'tabela', 2310400, [['ordem_id', 'string', 'id:OA-'], ['cliente_id', 'string', 'id:CLI-'], ['servico', 'string', 'enum:Fibra 500 Mb|Linha móvel|IP fixo'], ['status', 'string', 'enum:concluída|pendente|cancelada'], ['criada_em', 'timestamp', 'datahora:0:30']]),
      ],
      tools: [
        ['tel-tl-status-rede', 'consultar_status_rede', 'Status da célula ou da OLT que atende o endereço do cliente.', 'leitura'],
        ['tel-tl-ativar-servico', 'reprovisionar_servico', 'Reenvia a configuração do serviço para o equipamento do cliente.', 'escrita'],
      ],
    }),
    connector(ctx, {
      id: 'tel-con-itsm', typeId: 'servicenow', name: 'ITSM · ServiceNow', status: 'degradado', domainId: D.os, syncMode: 'sob_demanda',
      volume: 684000, latencyMs: 1460, consumers: [J.anchor, J.auto, 'tel-ct-os'],
      endpoint: 'https://ondatelecom{env}.service-now.example/api/now/v2',
      objects: [
        obj(ctx, 'incident', 'tabela', 684000, [['numero', 'string', 'id:INC00'], ['cliente_id', 'string', 'id:CLI-'], ['categoria', 'string', 'enum:Fatura|Sem sinal|Lentidão|Instalação'], ['prioridade', 'string', 'enum:P1|P2|P3|P4'], ['aberto_em', 'timestamp', 'datahora:0:15']]),
        obj(ctx, 'work_order (OS)', 'tabela', 221500, [['os_id', 'string', 'id:WO00'], ['endereco', 'string', 'endereco'], ['tecnico', 'string', 'nome'], ['sla_horas', 'integer', 'enum:4|8|24|48'], ['status', 'string', 'enum:agendada|em campo|concluída']]),
      ],
      tools: [
        ['tel-tl-criar-chamado', 'criar_chamado', 'Abre incidente ou OS com categoria, prioridade e descrição.', 'escrita'],
        ['tel-tl-consultar-chamado', 'consultar_chamado', 'Consulta status e SLA de um chamado.', 'leitura'],
      ],
    }),
    connector(ctx, {
      id: 'tel-con-kafka', typeId: 'kafka', name: 'Eventos de rede · Kafka', domainId: D.eventos, syncMode: 'cdc',
      volume: 42800000, latencyMs: 40, consumers: [J.auto],
      endpoint: 'kafka-{env}.ondatelecom.example:9093',
      objects: [
        obj(ctx, 'rede.alarmes.v2', 'objeto', 42800000, [['evento_id', 'string', 'id:EV-'], ['celula_id', 'string', 'id:CEL-'], ['severidade', 'string', 'enum:info|menor|maior|crítico'], ['ocorrido_em', 'timestamp', 'datahora:0:1']]),
        obj(ctx, 'atendimento.reclamacoes.v1', 'objeto', 1930000, [['reclamacao_id', 'string', 'id:RC-'], ['cliente_id', 'string', 'id:CLI-'], ['canal', 'string', 'enum:URA|Portal PME|WhatsApp'], ['tipo', 'string', 'enum:sem sinal|lentidão|queda']]),
      ],
      tools: [['tel-tl-ler-alarmes', 'ler_alarmes_recentes', 'Lê alarmes da região nos últimos 30 minutos.', 'leitura']],
    }),
    connector(ctx, {
      id: 'tel-con-lake', typeId: 'databricks', name: 'Lakehouse · Databricks', domainId: D.cliente, syncMode: 'agendado',
      volume: 412300, latencyMs: 720, consumers: [J.prd, 'tel-ct-cliente', 'tel-ct-oferta'],
      endpoint: 'https://adb-{env}.ondatelecom.example.azuredatabricks.net', envs: ['dev', 'hml', 'prd'],
      objects: [
        obj(ctx, 'ouro.perfil_cliente', 'tabela', 412300, [['cliente_id', 'string', 'id:CLI-'], ['segmento', 'string', 'enum:PME|Varejo'], ['meses_cliente', 'integer', 'int:1:140'], ['score_churn', 'decimal', 'pct:0:1'], ['plano_id', 'string', 'enum:PME-50|PME-100|FIBRA-500']]),
        obj(ctx, 'ouro.ofertas_vigentes', 'tabela', 64, [['plano_id', 'string', 'seq:PME-50|PME-100|FIBRA-500|VOZ-ILIM'], ['nome', 'string', 'seq:Onda PME Conecta 50 GB|Onda PME Conecta 100 GB|Onda Fibra Empresas 500 Mb|Voz Ilimitada PME'], ['preco', 'decimal', 'valor:59:399']]),
      ],
      tools: [['tel-tl-perfil-cliente', 'consultar_perfil_cliente', 'Perfil consolidado com segmento, tempo de casa e score de churn.', 'leitura']],
    }),
  ];

  const channels = [
    { id: 'tel-ch-whatsapp', type: 'whatsapp' as const, name: 'WhatsApp Onda Empresas', status: 'ativo' as const,
      config: { numero: '+55 11 4000-0000', templates: 'segunda_via_v2, protocolo_contestacao', optin: 'obrigatório no primeiro contato', horario: '24 horas' }, journeyByEnv: {} },
    { id: 'tel-ch-ura', type: 'voz' as const, name: 'URA 0800 Empresas', status: 'ativo' as const,
      config: { numero: '0800 000 1234', transcricao: 'tempo real', menu: 'falha técnica → jornada de diagnóstico' }, journeyByEnv: { dev: J.auto, hml: J.auto } },
    { id: 'tel-ch-portal', type: 'webchat' as const, name: 'Portal PME', status: 'ativo' as const,
      config: { cor: '#A07EFC', boasVindas: 'Olá! Sou a assistente da Onda Empresas.', horario: '24 horas' }, journeyByEnv: { dev: J.prd, hml: J.prd, prd: J.prd } },
    { id: 'tel-ch-backoffice', type: 'backoffice' as const, name: 'Backoffice de atendimento', status: 'ativo' as const,
      config: { fila: 'Retenção PME', sugestoes: 'ativadas' }, journeyByEnv: { dev: J.prd, hml: J.prd, prd: J.prd } },
  ];

  const systems = [
    { id: 'tel-sys-crm', name: 'BSS · CRM (Salesforce)', category: 'crm' as const },
    { id: 'tel-sys-billing', name: 'BSS · Billing', category: 'setorial' as const, connectorId: 'tel-con-billing' },
    { id: 'tel-sys-oss', name: 'OSS · Inventário e ativação', category: 'banco' as const, connectorId: 'tel-con-oss' },
    { id: 'tel-sys-itsm', name: 'ITSM', category: 'itsm' as const, connectorId: 'tel-con-itsm' },
    { id: 'tel-sys-eventos', name: 'Eventos de rede', category: 'eventos' as const, connectorId: 'tel-con-kafka' },
    { id: 'tel-sys-lake', name: 'Lakehouse', category: 'plataforma_dados' as const, connectorId: 'tel-con-lake' },
    { id: 'tel-sys-whatsapp', name: 'WhatsApp', category: 'canal' as const },
    { id: 'tel-sys-ura', name: 'URA', category: 'canal' as const },
    { id: 'tel-sys-portal', name: 'Portal PME', category: 'canal' as const },
    { id: 'tel-sys-backoffice', name: 'Backoffice', category: 'canal' as const },
  ];

  const domains = [
    { id: D.cliente, name: 'Cliente', kind: 'negocio' as const, owner: u('dono_negocio'), description: 'Pessoas e empresas atendidas, com segmento, contatos e consentimentos.', entities: ['Cliente', 'Contato', 'Consentimento'], relations: [D.contrato, D.fatura, D.os], products: ['tel-tb-our-perfil'], consumers: [J.prd], position: { x: 0, y: 0 } },
    { id: D.contrato, name: 'Contrato e plano', kind: 'negocio' as const, owner: u('dono_negocio'), description: 'Planos contratados, fidelidade e serviços ativos por linha.', entities: ['Contrato', 'Linha', 'Serviço'], relations: [D.cliente, D.oferta, D.fatura], products: [], consumers: [J.prd], position: { x: 300, y: 0 } },
    { id: D.fatura, name: 'Fatura', kind: 'negocio' as const, owner: u('dono_negocio'), description: 'Faturas, itens cobrados, pagamentos e contestações.', entities: ['Fatura', 'Item de fatura', 'Contestação'], relations: [D.cliente, D.contrato], products: ['tel-tb-our-fatura'], consumers: [J.anchor], position: { x: 600, y: 0 } },
    { id: D.os, name: 'Ordem de serviço', kind: 'negocio' as const, owner: u('champion'), description: 'Chamados técnicos, visitas e SLA de reparo.', entities: ['Ordem de serviço', 'Visita técnica'], relations: [D.cliente, D.rede], products: [], consumers: [J.auto], position: { x: 0, y: 240 } },
    { id: D.rede, name: 'Rede', kind: 'negocio' as const, owner: u('champion'), description: 'Células, OLTs, falhas e manutenção programada.', entities: ['Célula', 'Falha', 'Manutenção'], relations: [D.os, D.eventos], products: ['tel-tb-our-saude-rede'], consumers: [J.auto], position: { x: 300, y: 240 } },
    { id: D.oferta, name: 'Oferta', kind: 'negocio' as const, owner: u('dono_negocio'), description: 'Catálogo de planos, preços, elegibilidade e ofertas de retenção.', entities: ['Plano', 'Oferta de retenção'], relations: [D.contrato, D.cliente], products: [], consumers: [J.prd], position: { x: 600, y: 240 } },
    { id: D.eventos, name: 'Eventos', kind: 'tecnico' as const, owner: u('engenheiro_dados'), description: 'Alarmes de rede e reclamações em tempo real (Kafka).', entities: ['Alarme', 'Reclamação'], relations: [D.rede], products: [], consumers: [J.auto], position: { x: 900, y: 80 } },
    { id: D.logs, name: 'Logs', kind: 'tecnico' as const, owner: u('engenheiro_dados'), description: 'Traces das jornadas, auditoria e telemetria do Claude Code.', entities: ['Trace', 'Evento de auditoria'], relations: [D.eventos], products: [], consumers: [], position: { x: 900, y: 360 } },
  ];

  const contracts = [
    contract(ctx, {
      id: 'tel-ct-cliente', name: 'Contrato Cliente', domainId: D.cliente, entity: 'Cliente', owner: u('engenheiro_dados'),
      fields: [
        ['cliente_id', 'string', true, 'interno', 'Identificador do cliente no BSS.'],
        ['nome', 'string', true, 'pii', 'Nome do titular ou razão social.'],
        ['cpf_cnpj', 'string', true, 'pii', 'Documento do titular.'],
        ['email', 'string', false, 'pii', 'E-mail de contato.'],
        ['telefone', 'string', true, 'pii', 'Telefone principal (usado para identificar no WhatsApp).'],
        ['segmento', 'string', true, 'interno', 'PME, Varejo ou Corporativo; define regras de atendimento e oferta.'],
        ['uf', 'string', true, 'publico', 'Estado do endereço principal.'],
        ['score_churn', 'decimal', false, 'interno', 'Probabilidade de cancelamento em 60 dias (0 a 1).'],
        ['canal_preferido', 'string', false, 'interno', 'Canal preferido para contato ativo.'],
      ],
      addedInV2: ['score_churn', 'canal_preferido'],
      removedInV2: [['fax', 'string', false, 'pii', 'Campo legado sem uso.']],
      v2Note: 'Cliente v2: inclui score de churn e canal preferido; remove o campo legado fax.',
      freshness: '1h', expectedVolume: '410 mil a 420 mil registros', faixa: ['score_churn', 'score_churn between 0 and 1'],
    }),
    contract(ctx, {
      id: 'tel-ct-fatura', name: 'Contrato Fatura', domainId: D.fatura, entity: 'Fatura', owner: u('engenheiro_dados'),
      fields: [
        ['fatura_id', 'string', true, 'interno', 'Identificador da fatura.'],
        ['cliente_id', 'string', true, 'interno', 'Cliente titular.', 'Cliente.cliente_id'],
        ['competencia', 'string', true, 'interno', 'Mês de referência (AAAA-MM).'],
        ['valor_total', 'decimal', true, 'interno', 'Valor total em reais.'],
        ['vencimento', 'date', true, 'interno', 'Data de vencimento.'],
        ['linha_digitavel', 'string', true, 'sensivel', 'Código para pagamento.'],
        ['status', 'string', true, 'interno', 'aberta, paga ou vencida.'],
        ['itens_contestaveis', 'array', false, 'interno', 'Itens elegíveis a contestação automática.'],
      ],
      addedInV2: ['itens_contestaveis'],
      v2Note: 'Fatura v2: expõe itens contestáveis para a regra de contestação.',
      freshness: '15min', expectedVolume: '1,2 a 1,3 milhão por ciclo', faixa: ['valor_total', 'valor_total >= 0'],
    }),
    contract(ctx, {
      id: 'tel-ct-contrato', name: 'Contrato Plano', domainId: D.contrato, entity: 'Contrato', owner: u('engenheiro_dados'),
      fields: [
        ['contrato_id', 'string', true, 'interno', 'Identificador do contrato.'],
        ['cliente_id', 'string', true, 'interno', 'Cliente titular.', 'Cliente.cliente_id'],
        ['plano_id', 'string', true, 'interno', 'Plano contratado.', 'Oferta.plano_id'],
        ['valor_mensal', 'decimal', true, 'interno', 'Mensalidade vigente.'],
        ['fidelidade_ate', 'date', false, 'interno', 'Fim da fidelidade, quando houver.'],
        ['linhas', 'integer', true, 'interno', 'Quantidade de linhas no contrato.'],
      ],
      addedInV2: ['linhas'], v2Note: 'Inclui quantidade de linhas por contrato.',
      versions: ['1.0.0', '1.1.0'], freshness: '1h', expectedVolume: '520 mil contratos',
    }),
    contract(ctx, {
      id: 'tel-ct-oferta', name: 'Contrato Oferta', domainId: D.oferta, entity: 'Oferta', owner: u('dono_negocio'),
      fields: [
        ['plano_id', 'string', true, 'publico', 'Código do plano.'],
        ['nome', 'string', true, 'publico', 'Nome comercial.'],
        ['preco', 'decimal', true, 'publico', 'Preço de tabela vigente.'],
        ['elegibilidade', 'string', true, 'interno', 'Regra de elegibilidade (segmento, tempo de casa).'],
        ['desconto_retencao_max', 'decimal', false, 'interno', 'Desconto máximo de retenção permitido.'],
      ],
      addedInV2: ['desconto_retencao_max'], v2Note: 'Inclui o teto de desconto de retenção por plano.',
      freshness: '24h', expectedVolume: '60 a 80 ofertas vigentes',
    }),
    contract(ctx, {
      id: 'tel-ct-os', name: 'Contrato Ordem de serviço', domainId: D.os, entity: 'Ordem de serviço', owner: u('engenheiro_dados'),
      fields: [
        ['os_id', 'string', true, 'interno', 'Identificador da OS.'],
        ['cliente_id', 'string', true, 'interno', 'Cliente atendido.', 'Cliente.cliente_id'],
        ['tipo', 'string', true, 'interno', 'Reparo, instalação ou mudança de endereço.'],
        ['prioridade', 'string', true, 'interno', 'P1 a P4.'],
        ['sla_horas', 'integer', true, 'interno', 'SLA em horas.'],
        ['endereco', 'string', true, 'pii', 'Endereço da visita.'],
      ],
      addedInV2: ['prioridade'], v2Note: 'Prioridade passa a vir da tabela de decisão.',
      freshness: '30min', expectedVolume: '7 mil OS por dia',
    }),
    contract(ctx, {
      id: 'tel-ct-rede', name: 'Contrato Status de rede', domainId: D.rede, entity: 'Célula', owner: u('engenheiro_dados'),
      fields: [
        ['celula_id', 'string', true, 'interno', 'Identificador da célula ou OLT.'],
        ['regiao', 'string', true, 'publico', 'Cidade ou bairro atendido.'],
        ['status', 'string', true, 'interno', 'operando, degradada ou falha.'],
        ['falha_massiva', 'boolean', true, 'interno', 'Mais de 50 clientes afetados.'],
        ['previsao_normalizacao', 'timestamp', false, 'interno', 'Previsão informada pela engenharia de rede.'],
      ],
      addedInV2: ['previsao_normalizacao'], v2Note: 'Inclui previsão de normalização.',
      freshness: '5min', expectedVolume: '18 mil células', failing: true,
    }),
  ];

  const tables = [
    table(ctx, 'tel-tb-brz-faturas', 'brz_billing_faturas', 'bronze', D.fatura, 1284000, [['fatura_id', 'string', 'id:FT-2026-'], ['conta_id', 'string', 'id:BA-'], ['payload_competencia', 'string', 'enum:2026-09|2026-10'], ['valor_total', 'string', 'valor:79:1890'], ['recebido_em', 'timestamp', 'datahora:0:2']], 1),
    table(ctx, 'tel-tb-brz-clientes', 'brz_billing_contas', 'bronze', D.cliente, 412300, [['conta_id', 'string', 'id:BA-'], ['titular', 'string', 'nome'], ['cpf_cnpj', 'string', 'cpf'], ['telefone', 'string', 'telefone'], ['segmento_raw', 'string', 'enum:pme|PME|varejo|VAREJO']], 1),
    table(ctx, 'tel-tb-brz-alarmes', 'brz_kafka_alarmes_rede', 'bronze', D.eventos, 42800000, [['evento_id', 'string', 'id:EV-'], ['celula_id', 'string', 'id:CEL-'], ['severidade', 'string', 'enum:info|menor|maior|crítico'], ['ocorrido_em', 'timestamp', 'datahora:0:1']], 0),
    table(ctx, 'tel-tb-prt-faturas', 'prt_faturas', 'prata', D.fatura, 1281900, [['fatura_id', 'string', 'id:FT-2026-'], ['cliente_id', 'string', 'id:CLI-'], ['competencia', 'date', 'enum:2026-09-01|2026-10-01'], ['valor_total', 'decimal', 'valor:79:1890'], ['status', 'string', 'enum:aberta|paga|vencida']], 2),
    table(ctx, 'tel-tb-prt-clientes', 'prt_clientes', 'prata', D.cliente, 411870, [['cliente_id', 'string', 'id:CLI-'], ['nome_hash', 'string', 'hash'], ['cpf_cnpj_hash', 'string', 'hash'], ['segmento', 'string', 'enum:PME|Varejo'], ['uf', 'string', 'uf']], 2),
    table(ctx, 'tel-tb-prt-rede', 'prt_status_rede', 'prata', D.rede, 18420, [['celula_id', 'string', 'id:CEL-'], ['regiao', 'string', 'cidade'], ['status', 'string', 'enum:operando|degradada|falha'], ['alarmes_30min', 'integer', 'int:0:40']], 0),
    table(ctx, 'tel-tb-our-fatura', 'our_fatura_cliente_pme', 'ouro', D.fatura, 146200, [['cliente_id', 'string', 'id:CLI-'], ['competencia', 'date', 'enum:2026-10-01'], ['valor_total', 'decimal', 'valor:89:1890'], ['itens_contestaveis', 'integer', 'int:0:3'], ['contestacoes_12m', 'integer', 'int:0:4']], 3),
    table(ctx, 'tel-tb-our-perfil', 'our_perfil_cliente', 'ouro', D.cliente, 411870, [['cliente_id', 'string', 'id:CLI-'], ['segmento', 'string', 'enum:PME|Varejo'], ['meses_cliente', 'integer', 'int:1:140'], ['score_churn', 'decimal', 'pct:0:1'], ['canal_preferido', 'string', 'enum:WhatsApp|Portal|URA']], 4),
    table(ctx, 'tel-tb-our-saude-rede', 'our_saude_rede_regiao', 'ouro', D.rede, 940, [['regiao', 'string', 'cidade'], ['disponibilidade_pct', 'decimal', 'pct:97:100'], ['falhas_massivas_7d', 'integer', 'int:0:6'], ['clientes_afetados', 'integer', 'int:0:3200']], 1),
  ];

  const sqlExamples = [
    { id: 'tel-sql-1', question: 'Quantas faturas PME de outubro têm itens contestáveis?', sql: "SELECT count(*) AS faturas\nFROM our_fatura_cliente_pme\nWHERE competencia = DATE '2026-10-01'\n  AND itens_contestaveis > 0;", columns: ['faturas'], rows: [[18432]] },
    { id: 'tel-sql-2', question: 'Qual o score médio de churn por canal preferido?', sql: 'SELECT canal_preferido, round(avg(score_churn), 2) AS churn_medio, count(*) AS clientes\nFROM our_perfil_cliente\nWHERE segmento = \'PME\'\nGROUP BY canal_preferido\nORDER BY churn_medio DESC;', columns: ['canal_preferido', 'churn_medio', 'clientes'], rows: [['URA', 0.31, 11840], ['Portal', 0.22, 19210], ['WhatsApp', 0.17, 17160]] },
    { id: 'tel-sql-3', question: 'Quais regiões tiveram mais falhas massivas na semana?', sql: 'SELECT regiao, falhas_massivas_7d, clientes_afetados\nFROM our_saude_rede_regiao\nORDER BY falhas_massivas_7d DESC\nLIMIT 3;', columns: ['regiao', 'falhas_massivas_7d', 'clientes_afetados'], rows: [['Campinas', 5, 3120], ['Recife', 4, 2210], ['Goiânia', 3, 1480]] },
  ];

  const collections = [
    { id: 'tel-col-ofertas', name: 'Catálogo de ofertas', theme: 'Produtos', owner: u('dono_negocio'), domainId: D.oferta, profiles: ['dono_negocio', 'champion', 'engenheiro_ai'] as const, chunking: 'Por seção, até 400 tokens', embeddingModel: 'multilingual-e5-large' },
    { id: 'tel-col-regulacao', name: 'Regulação de telecom (resumos internos)', theme: 'Regulamentação', owner: u('seguranca'), profiles: ['dono_negocio', 'champion', 'coe', 'seguranca'] as const, chunking: 'Por artigo resumido, até 300 tokens', embeddingModel: 'multilingual-e5-large' },
    { id: 'tel-col-atendimento', name: 'Scripts e procedimentos de atendimento', theme: 'Manuais', owner: u('champion'), domainId: D.fatura, profiles: ['dono_negocio', 'champion', 'engenheiro_ai'] as const, chunking: 'Por passo do procedimento', embeddingModel: 'multilingual-e5-large' },
    { id: 'tel-col-retencao', name: 'Política de retenção', theme: 'Políticas', owner: u('dono_negocio'), domainId: D.oferta, profiles: ['dono_negocio', 'champion'] as const, chunking: 'Por seção, até 400 tokens', embeddingModel: 'multilingual-e5-large' },
  ].map((c) => ({ ...c, profiles: [...c.profiles] }));

  const documents = [
    { id: 'tel-doc-contestacao', collectionId: 'tel-col-atendimento', title: 'Procedimento de contestação de fatura v4', version: '4.0', updatedAt: dateAgo(18), status: 'processado' as const, chunks: [
      'A contestação pode ser aberta por qualquer canal oficial: WhatsApp, Portal PME, URA ou loja. O atendimento sempre informa um número de protocolo no mesmo contato.',
      'Para clientes PME, a Onda Telecom se compromete a concluir a análise da contestação em até 5 dias úteis. Casos simples, como cobrança duplicada, são resolvidos em até 2 dias úteis.',
      'Serviço cobrado sem contratação, com valor de até R$ 500 e cliente adimplente, gera crédito imediato na próxima fatura e cancelamento do serviço, sem necessidade de analista.',
      'Contestações acima de R$ 500 ou de clientes com pendência financeira seguem para o analista de faturamento, que pode suspender a cobrança do item enquanto analisa.',
      'O cliente é avisado da conclusão pelo canal em que abriu a contestação. Se discordar do resultado, pode pedir revisão uma única vez em até 30 dias.',
    ] },
    { id: 'tel-doc-segunda-via', collectionId: 'tel-col-atendimento', title: 'Script de segunda via de fatura', version: '2.3', updatedAt: dateAgo(40), status: 'processado' as const, chunks: [
      'Confirme a identidade pelo número cadastrado ou pelos três primeiros dígitos do CNPJ antes de enviar qualquer valor.',
      'Envie a segunda via com valor, vencimento e linha digitável. Nunca envie CPF ou endereço completo pelo canal.',
      'Se a fatura estiver vencida, informe os encargos e ofereça o pagamento por PIX com o código da própria fatura.',
    ] },
    { id: 'tel-doc-retencao', collectionId: 'tel-col-retencao', title: 'Política de retenção PME 2026', version: '2026.2', updatedAt: dateAgo(25), status: 'processado' as const, chunks: [
      'A oferta de retenção só pode ser feita dentro da elegibilidade do plano atual, conforme a tabela de elegibilidade publicada no cérebro.',
      'Clientes com mais de 24 meses de casa e score de churn acima de 0,6 podem receber até 20% de desconto por 6 meses ou upgrade de franquia.',
      'O cancelamento sem multa é garantido quando a fidelidade terminou. Durante a fidelidade, a multa é proporcional aos meses restantes, e o atendente deve informar o valor exato.',
      'Clientes inadimplentes não recebem desconto de retenção; o atendimento oferece renegociação da dívida antes de qualquer oferta.',
    ] },
    { id: 'tel-doc-catalogo', collectionId: 'tel-col-ofertas', title: 'Catálogo de ofertas PME 2026', version: '2026.4', updatedAt: dateAgo(12), status: 'processado' as const, chunks: [
      'Onda PME Conecta 50 GB: R$ 89,90 por linha, voz ilimitada e WhatsApp sem descontar da franquia.',
      'Onda PME Conecta 100 GB: R$ 129,90 por linha, com roaming nacional incluso e gestor de linhas no portal.',
      'Onda Fibra Empresas 500 Mb: R$ 199,90 com IP fixo opcional por R$ 49,90 e visita técnica em até 8 horas.',
      'Combos de móvel e fibra têm 10% de desconto no total enquanto ambos os serviços estiverem ativos.',
    ] },
    { id: 'tel-doc-direitos', collectionId: 'tel-col-regulacao', title: 'Guia interno de direitos do consumidor de telecom', version: '3.1', updatedAt: dateAgo(60), status: 'processado' as const, chunks: [
      'Este guia resume, em linguagem interna, os compromissos da Onda Telecom com o consumidor. Não substitui o texto oficial das normas do setor.',
      'Todo atendimento gera protocolo informado ao cliente no início ou no fim do contato, por qualquer canal.',
      'O cliente pode pedir cancelamento por qualquer canal de atendimento, sem precisar falar com um atendente de retenção.',
      'Cobranças contestadas devem ter resposta registrada e comunicada ao cliente, com os motivos da decisão.',
    ] },
    { id: 'tel-doc-diagnostico', collectionId: 'tel-col-atendimento', title: 'Manual de diagnóstico de conectividade', version: '1.6', updatedAt: dateAgo(33), status: 'processando' as const, chunks: [
      'Antes de abrir OS, verifique se há falha massiva na região. Em falha massiva, informe a previsão de normalização e não abra OS individual.',
      'Sem falha massiva, a prioridade da OS segue a tabela do cérebro: PME sem serviço há mais de 4 horas é P2.',
      'Reprovisionar o serviço remotamente resolve cerca de um terço das reclamações de lentidão em fibra.',
    ] },
  ];

  const retrievals = [
    { question: DEMO.showcaseQuestion, answer: 'Para clientes PME, a análise da contestação é concluída em até 5 dias úteis; casos simples, como cobrança duplicada, em até 2 dias úteis. O protocolo é informado no mesmo contato.', results: [{ docId: 'tel-doc-contestacao', chunkIndex: 1, score: 0.93 }, { docId: 'tel-doc-contestacao', chunkIndex: 0, score: 0.81 }, { docId: 'tel-doc-direitos', chunkIndex: 3, score: 0.67 }] },
    { question: 'posso dar desconto de retenção para cliente inadimplente?', answer: 'Não. Clientes inadimplentes não recebem desconto de retenção; a política orienta oferecer renegociação da dívida antes de qualquer oferta.', results: [{ docId: 'tel-doc-retencao', chunkIndex: 3, score: 0.91 }, { docId: 'tel-doc-retencao', chunkIndex: 0, score: 0.74 }] },
    { question: 'o que fazer quando há falha massiva na região do cliente?', answer: 'Informar a previsão de normalização e não abrir OS individual; sem falha massiva, a prioridade da OS segue a tabela do cérebro.', results: [{ docId: 'tel-doc-diagnostico', chunkIndex: 0, score: 0.94 }, { docId: 'tel-doc-diagnostico', chunkIndex: 1, score: 0.72 }] },
  ];

  const knowledgeGraph = {
    nodes: [
      { id: 'tel-kg-cliente', label: 'Cliente', kind: 'entidade' as const },
      { id: 'tel-kg-fatura', label: 'Fatura', kind: 'entidade' as const },
      { id: 'tel-kg-contestacao', label: 'Contestação', kind: 'entidade' as const },
      { id: 'tel-kg-oferta', label: 'Oferta', kind: 'entidade' as const },
      { id: 'tel-kg-os', label: 'Ordem de serviço', kind: 'entidade' as const },
      { id: 'tel-tb-our-fatura', label: 'our_fatura_cliente_pme', kind: 'tabela' as const },
      { id: 'tel-tb-our-perfil', label: 'our_perfil_cliente', kind: 'tabela' as const },
      { id: 'tel-tb-prt-rede', label: 'prt_status_rede', kind: 'tabela' as const },
      { id: 'tel-doc-contestacao', label: 'Procedimento de contestação v4', kind: 'documento' as const },
      { id: 'tel-doc-retencao', label: 'Política de retenção PME 2026', kind: 'documento' as const },
      { id: 'tel-doc-diagnostico', label: 'Manual de diagnóstico', kind: 'documento' as const },
      { id: 'tel-dt-contestacao', label: 'Contestação de fatura', kind: 'regra' as const },
      { id: 'tel-dt-retencao', label: 'Elegibilidade de retenção', kind: 'regra' as const },
    ],
    edges: [
      { source: 'tel-kg-cliente', target: 'tel-kg-fatura', label: 'recebe' },
      { source: 'tel-kg-fatura', target: 'tel-kg-contestacao', label: 'pode ter' },
      { source: 'tel-kg-fatura', target: 'tel-tb-our-fatura', label: 'publicada em' },
      { source: 'tel-kg-cliente', target: 'tel-tb-our-perfil', label: 'publicada em' },
      { source: 'tel-kg-contestacao', target: 'tel-dt-contestacao', label: 'decidida por' },
      { source: 'tel-dt-contestacao', target: 'tel-doc-contestacao', label: 'origem' },
      { source: 'tel-kg-oferta', target: 'tel-dt-retencao', label: 'elegibilidade' },
      { source: 'tel-dt-retencao', target: 'tel-doc-retencao', label: 'origem' },
      { source: 'tel-kg-cliente', target: 'tel-kg-oferta', label: 'contrata' },
      { source: 'tel-kg-cliente', target: 'tel-kg-os', label: 'solicita' },
      { source: 'tel-kg-os', target: 'tel-tb-prt-rede', label: 'consulta' },
      { source: 'tel-kg-os', target: 'tel-doc-diagnostico', label: 'procedimento' },
    ],
  };

  const artifacts = [
    { id: 'tel-art-okr-rpc', areaId: 'area-empresa', kind: 'OKR', title: 'Elevar a resolução no primeiro contato PME para 75%', summary: 'Objetivo de 2026 para o atendimento PME, medido mensalmente por canal.', tags: ['okr', 'atendimento', 'pme'], metrics: [{ label: 'Atual', value: '69%' }, { label: 'Meta', value: '75%' }] },
    { id: 'tel-art-okr-digital', areaId: 'area-empresa', kind: 'OKR', title: 'Levar 60% dos atendimentos de fatura para canais digitais', summary: 'Reduzir ligações na URA para segunda via e contestação.', tags: ['okr', 'digital'], metrics: [{ label: 'Atual', value: '41%' }, { label: 'Meta', value: '60%' }] },
    { id: 'tel-art-proc-atend', areaId: 'area-empresa', kind: 'Processo', title: 'Processo de atendimento de fatura PME', summary: 'Identificar cliente → entender pedido → consultar fatura → resolver ou contestar → registrar protocolo.', tags: ['processo', 'fatura'] },
    { id: 'tel-art-mkt-bench', areaId: 'area-mercado', kind: 'Ficha de mercado', title: 'Benchmark de atendimento digital em operadoras', summary: 'Quatro de cinco operadoras pesquisadas já oferecem segunda via no WhatsApp; só uma resolve contestação sem atendente.', body: 'Fonte: pesquisa interna com cinco operadoras (fictícia), setembro de 2026.', tags: ['benchmark', 'whatsapp'], metrics: [{ label: 'Fonte', value: 'Pesquisa interna' }, { label: 'Data', value: 'set/2026' }] },
    { id: 'tel-art-mkt-reg', areaId: 'area-mercado', kind: 'Ficha de regulação', title: 'Obrigações de atendimento e contestação', summary: 'Protocolo em todo atendimento, cancelamento por qualquer canal e resposta registrada a contestações.', body: 'Fonte: Guia interno de direitos do consumidor de telecom, revisão de agosto de 2026. Origina a regra "Contestação de fatura".', tags: ['regulação', 'contestação'], metrics: [{ label: 'Fonte', value: 'Guia interno v3.1' }, { label: 'Data', value: 'ago/2026' }] },
    { id: 'tel-art-mkt-fibra', areaId: 'area-mercado', kind: 'Ficha de mercado', title: 'Concorrência em fibra para PME', summary: 'Preço médio de 500 Mb para empresas entre R$ 189 e R$ 249 nas capitais pesquisadas.', tags: ['fibra', 'preço'], metrics: [{ label: 'Fonte', value: 'Levantamento comercial' }, { label: 'Data', value: 'out/2026' }] },
    { id: 'tel-art-jor-fatura', areaId: 'area-jornadas', kind: 'Mapa de jornada', title: 'Atendimento de fatura PME', summary: 'Etapas: dúvida → contato → identificação → resolução → confirmação. Dor principal: tempo de espera na URA para segunda via.', tags: ['jornada', 'fatura'], metrics: [{ label: 'KPI', value: 'Resolução no primeiro contato' }, { label: 'Canais', value: 'WhatsApp, URA, Portal' }] },
    { id: 'tel-art-jor-cancel', areaId: 'area-jornadas', kind: 'Mapa de jornada', title: 'Cancelamento e retenção', summary: 'Etapas: insatisfação → pedido → oferta → decisão. Dor: ofertas fora da elegibilidade geram reclamação.', tags: ['jornada', 'retenção'], metrics: [{ label: 'KPI', value: 'Churn PME' }] },
    { id: 'tel-art-jor-tecnico', areaId: 'area-jornadas', kind: 'Mapa de jornada', title: 'Suporte técnico', summary: 'Etapas: falha → reclamação → diagnóstico → OS → visita. Dor: OS aberta durante falha massiva.', tags: ['jornada', 'suporte'] },
    { id: 'tel-art-prd-50', areaId: 'area-produtos', kind: 'Produto', title: 'Onda PME Conecta 50 GB', summary: 'R$ 89,90 por linha, voz ilimitada. Elegível a PME com CNPJ ativo.', tags: ['móvel', 'pme'], metrics: [{ label: 'Preço', value: 'R$ 89,90' }] },
    { id: 'tel-art-prd-100', areaId: 'area-produtos', kind: 'Produto', title: 'Onda PME Conecta 100 GB', summary: 'R$ 129,90 por linha, roaming nacional incluso.', tags: ['móvel', 'pme'], metrics: [{ label: 'Preço', value: 'R$ 129,90' }] },
    { id: 'tel-art-prd-fibra', areaId: 'area-produtos', kind: 'Produto', title: 'Onda Fibra Empresas 500 Mb', summary: 'R$ 199,90, IP fixo opcional, visita técnica em até 8 horas.', tags: ['fibra'], metrics: [{ label: 'Preço', value: 'R$ 199,90' }] },
    { id: 'tel-art-reg-contest', areaId: 'area-regras', kind: 'Tabela de decisão', title: 'Contestação de fatura', summary: 'Define ação, prazo e alçada por motivo e valor contestado.', tags: ['regra', 'fatura'], componentId: 'tel-cp-rule-contestacao' },
    { id: 'tel-art-reg-ret', areaId: 'area-regras', kind: 'Tabela de decisão', title: 'Elegibilidade de oferta de retenção', summary: 'Oferta e desconto máximo por tempo de casa, plano e score de churn.', tags: ['regra', 'retenção'], componentId: 'tel-cp-rule-retencao' },
    { id: 'tel-art-reg-alcada', areaId: 'area-regras', kind: 'Alçada', title: 'Alçadas de crédito em fatura', summary: 'Agente até R$ 500; analista até R$ 5 mil; acima disso, coordenação de faturamento.', tags: ['alçada', 'crédito'] },
    { id: 'tel-art-tmf', areaId: 'area-arquitetura', kind: 'Integração padrão', title: 'TM Forum Open APIs como contrato de integração BSS', summary: 'Billing, catálogo e trouble ticket seguem TMF678, TMF620 e TMF621.', tags: ['tmforum', 'bss'] },
  ];

  const decisionTables = [
    {
      id: 'tel-dt-contestacao', name: 'Contestação de fatura', domainId: D.fatura, version: '3.0.0', componentId: 'tel-cp-rule-contestacao',
      description: 'Define a ação, o prazo e a alçada de uma contestação de fatura a partir do motivo e do valor.',
      source: 'Procedimento de contestação de fatura v4 e Guia interno de direitos do consumidor',
      inputs: [
        { key: 'motivo', label: 'Motivo', type: 'enum' as const, options: ['servico_nao_contratado', 'cobranca_duplicada', 'valor_divergente', 'outro'] },
        { key: 'valor_contestado', label: 'Valor contestado (R$)', type: 'number' as const },
        { key: 'segmento', label: 'Segmento', type: 'enum' as const, options: ['PME', 'Varejo'] },
        { key: 'cliente_adimplente', label: 'Cliente adimplente', type: 'boolean' as const },
      ],
      outputs: [{ key: 'acao', label: 'Ação' }, { key: 'prazo', label: 'Prazo' }, { key: 'alcada', label: 'Alçada' }],
      rows: [
        { id: 'r1', conditions: { motivo: '=cobranca_duplicada', valor_contestado: '*', segmento: '*', cliente_adimplente: '*' }, outputs: { acao: 'Estorno automático na próxima fatura', prazo: '2 dias úteis', alcada: 'Agente' } },
        { id: 'r2', conditions: { motivo: '=servico_nao_contratado', valor_contestado: '<=500', segmento: 'PME|Varejo', cliente_adimplente: '=true' }, outputs: { acao: 'Crédito imediato e cancelamento do serviço', prazo: '1 dia útil', alcada: 'Agente' } },
        { id: 'r3', conditions: { motivo: '=servico_nao_contratado', valor_contestado: '>500', segmento: '*', cliente_adimplente: '*' }, outputs: { acao: 'Abrir contestação para analista', prazo: '5 dias úteis', alcada: 'Analista de faturamento' } },
        { id: 'r4', conditions: { motivo: '=servico_nao_contratado', valor_contestado: '<=500', segmento: '*', cliente_adimplente: '=false' }, outputs: { acao: 'Suspender cobrança do item e enviar para analista', prazo: '5 dias úteis', alcada: 'Analista de faturamento' } },
        { id: 'r5', conditions: { motivo: '=valor_divergente', valor_contestado: '0..200', segmento: '*', cliente_adimplente: '*' }, outputs: { acao: 'Ajuste automático pela tabela vigente', prazo: '2 dias úteis', alcada: 'Agente' } },
        { id: 'r6', conditions: { motivo: '=valor_divergente', valor_contestado: '>200', segmento: '*', cliente_adimplente: '*' }, outputs: { acao: 'Abrir contestação para analista', prazo: '5 dias úteis', alcada: 'Analista de faturamento' } },
        { id: 'r7', conditions: { motivo: '=outro', valor_contestado: '*', segmento: '*', cliente_adimplente: '*' }, outputs: { acao: 'Transbordo para atendente com resumo', prazo: 'Mesmo dia', alcada: 'Atendente' }, note: 'Motivos fora da taxonomia vão para pessoas.' },
      ],
      sampleCase: { motivo: 'servico_nao_contratado', valor_contestado: 89.9, segmento: 'PME', cliente_adimplente: true },
    },
    {
      id: 'tel-dt-retencao', name: 'Elegibilidade de oferta de retenção', domainId: D.oferta, version: '1.2.0', componentId: 'tel-cp-rule-retencao',
      description: 'Indica a oferta de retenção permitida pelo plano, tempo de casa e risco de churn.',
      source: 'Política de retenção PME 2026',
      inputs: [
        { key: 'meses_cliente', label: 'Meses como cliente', type: 'number' as const },
        { key: 'score_churn', label: 'Score de churn', type: 'number' as const },
        { key: 'inadimplente', label: 'Inadimplente', type: 'boolean' as const },
      ],
      outputs: [{ key: 'oferta', label: 'Oferta' }, { key: 'desconto_max', label: 'Desconto máximo' }],
      rows: [
        { id: 'r1', conditions: { meses_cliente: '*', score_churn: '*', inadimplente: '=true' }, outputs: { oferta: 'Renegociação de dívida', desconto_max: '0%' } },
        { id: 'r2', conditions: { meses_cliente: '>=24', score_churn: '>0.6', inadimplente: '=false' }, outputs: { oferta: 'Desconto por 6 meses', desconto_max: '20%' } },
        { id: 'r3', conditions: { meses_cliente: '>=24', score_churn: '<=0.6', inadimplente: '=false' }, outputs: { oferta: 'Upgrade de franquia', desconto_max: '10%' } },
        { id: 'r4', conditions: { meses_cliente: '<24', score_churn: '*', inadimplente: '=false' }, outputs: { oferta: 'Bônus de 10 GB por 3 meses', desconto_max: '0%' } },
      ],
      sampleCase: { meses_cliente: 38, score_churn: 0.72, inadimplente: false },
    },
    {
      id: 'tel-dt-prioridade-os', name: 'Prioridade de ordem de serviço', domainId: D.os, version: '1.0.0',
      description: 'Prioridade e SLA da OS técnica conforme segmento e tempo sem serviço.',
      source: 'Manual de diagnóstico de conectividade',
      inputs: [
        { key: 'segmento', label: 'Segmento', type: 'enum' as const, options: ['PME', 'Varejo'] },
        { key: 'horas_sem_servico', label: 'Horas sem serviço', type: 'number' as const },
      ],
      outputs: [{ key: 'prioridade', label: 'Prioridade' }, { key: 'sla', label: 'SLA' }],
      rows: [
        { id: 'r1', conditions: { segmento: '=PME', horas_sem_servico: '>4' }, outputs: { prioridade: 'P2', sla: '8 horas' } },
        { id: 'r2', conditions: { segmento: '=PME', horas_sem_servico: '<=4' }, outputs: { prioridade: 'P3', sla: '24 horas' } },
        { id: 'r3', conditions: { segmento: '=Varejo', horas_sem_servico: '*' }, outputs: { prioridade: 'P4', sla: '48 horas' } },
      ],
      sampleCase: { segmento: 'PME', horas_sem_servico: 6 },
    },
  ];

  const components: IndustryContent['components'] = [
    { id: 'tel-cp-agent-pme', type: 'agent', name: 'Agente de atendimento PME', version: '2.1.0', status: 'publicado_prd', domainId: D.fatura, owner: 'champion',
      description: 'Atende clientes PME em fatura, segunda via e contestação, usando as regras e tools homologadas.',
      content: 'Papel: atendente digital da Onda Empresas.\nSkills: Calcular segunda via de fatura; Resumir conversa para transbordo.\nRegras: Contestação de fatura; Responder somente com fonte homologada.\nTools: consultar_fatura, gerar_segunda_via, abrir_contestacao.\nTom: cordial, objetivo, sem jargão técnico.',
      inputs: ['mensagem do cliente', 'intenções classificadas', 'perfil do cliente'], outputs: ['plano de atendimento', 'resposta ao cliente'],
      dependencies: ['tel-cp-skill-segunda-via', 'tel-cp-rule-contestacao', 'tel-cp-rule-fonte', 'tel-cp-skill-resumo'],
      log: [['1.0.0', 160, 'Versão inicial para segunda via.'], ['2.0.0', 70, 'Inclui contestação.'], ['2.1.0', 22, 'Usa regra de contestação v3.']] },
    { id: 'tel-cp-skill-segunda-via', type: 'skill', name: 'Calcular segunda via de fatura', version: '1.4.0', status: 'publicado_prd', domainId: D.fatura, owner: 'engenheiro_ai',
      description: 'Calcula valor atualizado com encargos e gera a segunda via com linha digitável e PIX.',
      content: 'Instruções: 1) consulte a fatura pela competência; 2) se vencida, aplique multa de 2% e juros de 1% ao mês pro rata; 3) gere a linha digitável e o código PIX; 4) nunca inclua CPF ou endereço na resposta.',
      inputs: ['cliente_id', 'competência'], outputs: ['valor atualizado', 'linha digitável', 'código PIX'], dependencies: ['tel-cp-mcp-core'],
      log: [['1.0.0', 200, 'Versão inicial.'], ['1.4.0', 35, 'Inclui código PIX.']] },
    { id: 'tel-cp-rule-contestacao', type: 'rule', name: 'Regra de contestação de fatura', version: '3.0.0', status: 'publicado_prd', domainId: D.fatura, owner: 'dono_negocio',
      description: 'Tabela de decisão publicada como componente: ação, prazo e alçada da contestação.',
      content: 'Fonte: tabela "Contestação de fatura" v3.0.0 (7 linhas).\nSaídas: acao, prazo, alcada.\nCasos de teste: 14, cobrindo todas as linhas.',
      inputs: ['motivo', 'valor_contestado', 'segmento', 'cliente_adimplente'], outputs: ['acao', 'prazo', 'alcada'],
      log: [['2.0.0', 120, 'Inclui valor divergente.'], ['3.0.0', 15, 'Separa cliente inadimplente (linha 4).']] },
    { id: 'tel-cp-rule-retencao', type: 'rule', name: 'Oferta de retenção dentro da elegibilidade do plano', version: '1.2.0', status: 'publicado_prd', domainId: D.oferta, owner: 'dono_negocio',
      description: 'Guardrail de destaque: o agente só oferece o que a tabela de elegibilidade permite.',
      content: 'SE oferta.desconto > elegibilidade.desconto_max OU oferta.plano NAO EM elegibilidade.planos\nENTAO bloquear_oferta E registrar_guardrail',
      inputs: ['oferta proposta', 'elegibilidade do cliente'], outputs: ['oferta liberada ou bloqueio'] },
    { id: 'tel-cp-agent-retencao', type: 'agent', name: 'Agente de retenção', version: '1.5.0', status: 'publicado_prd', domainId: D.oferta, owner: 'champion',
      description: 'Entende o motivo do cancelamento e apresenta a oferta elegível, sem pressionar o cliente.',
      content: 'Papel: especialista em retenção PME.\nRegras: Oferta de retenção dentro da elegibilidade do plano.\nSkill: Resumir conversa para transbordo.\nSempre informe que o cliente pode cancelar se preferir.',
      inputs: ['pedido de cancelamento', 'perfil do cliente', 'oferta elegível'], outputs: ['proposta de retenção'], dependencies: ['tel-cp-rule-retencao', 'tel-cp-skill-resumo'] },
    { id: 'tel-cp-doc-direitos', type: 'documento', name: 'Guia interno de direitos do consumidor de telecom', version: '3.1.0', status: 'homologado', owner: 'seguranca',
      description: 'Documento de referência versionado usado pelos agentes de atendimento.',
      content: 'Documento: tel-doc-direitos (4 trechos). Uso: recurso MCP e base de conhecimento.', inputs: [], outputs: ['trechos citáveis'] },
    { id: 'tel-cp-pacote-digital', type: 'pacote', name: 'Pacote Atendimento Digital 2.1', version: '2.1.0', status: 'homologado', domainId: D.fatura, owner: 'champion', packageKind: 'jornada',
      description: 'Composição homologada para jornadas curtas de atendimento digital de fatura.',
      content: 'Componentes fixados:\n- Agente de atendimento PME 2.1.0\n- Calcular segunda via de fatura 1.4.0\n- Regra de contestação de fatura 3.0.0\n- Mascarar PII antes de enviar ao canal 1.3.0',
      inputs: [], outputs: ['plugin cortex-atendimento-digital@2.1.0'],
      dependencies: ['tel-cp-agent-pme', 'tel-cp-skill-segunda-via', 'tel-cp-rule-contestacao', 'tel-cp-hook-pii'] },
    { id: 'tel-cp-pacote-os', type: 'pacote', name: 'Esteira de diagnóstico e OS', version: '0.9.0', status: 'em_revisao', domainId: D.os, owner: 'champion', packageKind: 'esteira',
      description: 'Esteira durável que diagnostica a falha, prioriza e abre a OS no ITSM.',
      content: 'Componentes fixados:\n- Interpretar status de rede 0.4.0\n- MCP do Billing BSS 1.2.0',
      inputs: [], outputs: ['plugin cortex-diagnostico-os@0.9.0'], dependencies: ['tel-cp-skill-rede', 'tel-cp-mcp-core'] },
    { id: 'tel-cp-skill-rede', type: 'skill', name: 'Interpretar status de rede', version: '0.4.0', status: 'rascunho', domainId: D.rede, owner: 'engenheiro_ai',
      description: 'Traduz alarmes técnicos em uma explicação simples para o cliente.',
      content: 'Instruções: transforme o status da célula em uma frase curta para o cliente, com previsão de normalização quando houver.', inputs: ['status da célula'], outputs: ['explicação ao cliente'] },
  ];

  const piiOut = 'Fatura FT-2026-10-204871: R$ 412,37, vencimento 05/11/2026. Titular Juliana Prado, CPF 318.482.913-88, telefone (11) 98821-4821, endereço Rua das Acácias, 120.';
  const journeys: IndustryContent['journeys'] = [
    {
      id: J.anchor, name: 'Segunda via e contestação de fatura PME', anchor: true, type: 'agentica', domainId: D.fatura, initiativeId: 'tel-in-01',
      description: 'O cliente PME pede a segunda via e contesta itens da fatura pelo WhatsApp, sem passar pela URA.',
      triggerLabel: 'Mensagem no WhatsApp', risk: 'supervisionada',
      brainInputs: ['Contrato Fatura', 'Regras de contestação', 'Regulamento da Anatel (guia interno)'],
      persona: { name: 'Juliana Prado · Prado Contabilidade ME', message: 'Oi! Preciso da segunda via da fatura de outubro e acho que cobraram um pacote de dados que não contratei.' },
      kpis: ['Resolução no primeiro contato', 'Tempo médio de atendimento', 'Contestações resolvidas sem atendente'],
      testCases: [
        ['Segunda via simples', 'Quero a segunda via da fatura de setembro', 'Envia valor, vencimento e linha digitável, sem CPF aberto', 'passou'],
        ['Contestação de pacote não contratado', 'Cobraram um pacote de dados de R$ 89,90 que não contratei', 'Aplica a linha 2 da regra e informa protocolo', 'passou'],
        ['Contestação de alto valor', 'Veio R$ 1.200 de roaming que não usei', 'Encaminha ao analista de faturamento (linha 3)', 'falhou'],
      ],
      nodes: [
        { id: 'msg', kind: 'gatilho.mensagem', label: 'Mensagem WhatsApp', at: [0, 1], channelId: 'tel-ch-whatsapp', to: 'intencao',
          s: { in: 'Oi! Preciso da segunda via da fatura de outubro e acho que cobraram um pacote de dados que não contratei.', out: 'Mensagem de +55 11 9****-4821; cliente PME identificado pelo número (CLI-204871).', ms: 40 } },
        { id: 'intencao', kind: 'agente.intencao', label: 'Classificar intenção', at: [1, 1], to: 'agente',
          s: { in: 'Texto da mensagem', out: 'Intenções: segunda_via (0,96) e contestacao (0,88).', src: 'Taxonomia de intenções · Jornadas de cliente', tok: 420, ms: 610 } },
        { id: 'agente', kind: 'agente.agente', label: 'Agente de fatura', at: [2, 1], componentId: 'tel-cp-agent-pme', to: 'cond',
          s: { in: 'Intenções classificadas + perfil PME', out: 'Plano: 1) validar a contestação do pacote de dados; 2) gerar a segunda via de outubro.', rule: 'Agente de atendimento PME 2.1.0', tok: 1380, ms: 1720 } },
        { id: 'cond', kind: 'logica.condicao', label: 'Há contestação?', at: [3, 1], to: { sim: 'regra', 'não': 'fatura' },
          s: { in: 'contestacao = 0,88 (limiar 0,70)', out: 'sim', ms: 20, take: 'sim' } },
        { id: 'regra', kind: 'logica.tabela', label: 'Regra de contestação', at: [4, 0], ruleId: 'tel-dt-contestacao', componentId: 'tel-cp-rule-contestacao', to: 'itsm',
          s: { in: 'motivo=servico_nao_contratado, valor=R$ 89,90, segmento=PME, adimplente=sim', out: 'Linha 2: crédito imediato e cancelamento do serviço; prazo 1 dia útil; alçada Agente.', rule: 'Contestação de fatura v3.0.0 · linha 2', src: 'Procedimento de contestação de fatura v4', ms: 35 } },
        { id: 'itsm', kind: 'saida.itsm', label: 'Registrar contestação no ITSM', at: [5, 0], toolId: 'tel-tl-criar-chamado', to: 'fatura',
          s: { in: 'Contestação: pacote de dados 10 GB, R$ 89,90', out: 'Chamado INC0048213 aberto; crédito de R$ 89,90 programado para a fatura de novembro.', ms: 840 } },
        { id: 'fatura', kind: 'dados.tool', label: 'Consultar fatura', at: [5, 1], toolId: 'tel-tl-consultar-fatura', contractId: 'tel-ct-fatura', emitsPii: true, to: 'responder',
          s: { in: 'cliente_id=CLI-204871, competencia=2026-10', out: piiOut, src: 'Contrato Fatura v2.0.0', ms: 640 } },
        { id: 'responder', kind: 'saida.responder', label: 'Responder no canal', at: [6, 1], channelId: 'tel-ch-whatsapp',
          s: { in: 'Segunda via + protocolo da contestação', out: 'Juliana, aqui está a segunda via de outubro: R$ 412,37, vencimento em 05/11. Abri a contestação do pacote de dados e o crédito de R$ 89,90 entra na próxima fatura. Protocolo INC0048213.', ms: 260 } },
      ],
      versions: [
        { version: '0.1.0', daysAgo: 6, author: 'champion', note: 'Rascunho gerado por /cortex:desenhar a partir da iniciativa.', drop: ['cond', 'regra', 'itsm'] },
        { version: '0.2.0', daysAgo: 1, author: 'engenheiro_ai', note: 'Inclui o ramo de contestação com a regra do cérebro e o registro no ITSM.' },
      ],
      envVersions: { dev: '0.2.0', hml: null, prd: null },
      piiFilter: { in: 'Saída de "Consultar fatura" com nome completo, CPF, telefone e endereço do titular', out: 'Fatura FT-2026-10-204871: R$ 412,37, vencimento 05/11/2026. Titular Juliana, CPF ***.482.913-**, telefone (11) 9****-4821; endereço removido.' },
    },
    {
      id: J.prd, name: 'Retenção com oferta personalizada', type: 'agentica', domainId: D.oferta, initiativeId: 'tel-in-05',
      description: 'Quando o cliente pede cancelamento, o agente entende o motivo e apresenta a oferta elegível pelo plano.',
      triggerLabel: 'Pedido de cancelamento', risk: 'supervisionada',
      brainInputs: ['Catálogo de ofertas', 'Elegibilidade', 'Histórico do cliente'],
      persona: { name: 'Marcos Valença · Valença Engenharia Ltda', message: 'Quero cancelar meu plano, achei uma proposta mais barata.' },
      kpis: ['Churn PME', 'Taxa de retenção', 'Custo por retenção'],
      testCases: [
        ['Cliente antigo com alto risco', 'Quero cancelar, está caro', 'Oferece desconto de até 20% por 6 meses', 'passou'],
        ['Cliente inadimplente', 'Quero cancelar tudo', 'Oferece renegociação, sem desconto', 'passou'],
        ['Cliente novo', 'Vou trocar de operadora', 'Oferece bônus de franquia e informa multa proporcional', 'passou'],
      ],
      nodes: [
        { id: 'pedido', kind: 'gatilho.mensagem', label: 'Pedido de cancelamento', at: [0, 1], channelId: 'tel-ch-portal', to: 'perfil',
          s: { in: 'Quero cancelar meu plano, achei uma proposta mais barata.', out: 'Pedido de cancelamento do contrato CT-88120 (Valença Engenharia Ltda).', ms: 45 } },
        { id: 'perfil', kind: 'dados.produto', label: 'Ler perfil do cliente', at: [1, 1], contractId: 'tel-ct-cliente', toolId: 'tel-tl-perfil-cliente', emitsPii: true, to: 'elegib',
          s: { in: 'cliente_id=CLI-311904', out: 'Segmento PME, 38 meses de casa, score de churn 0,72, adimplente, plano PME-100 com 6 linhas.', src: 'Contrato Cliente v2.0.0', ms: 380 } },
        { id: 'elegib', kind: 'logica.tabela', label: 'Elegibilidade de oferta', at: [2, 1], ruleId: 'tel-dt-retencao', componentId: 'tel-cp-rule-retencao', to: 'cond',
          s: { in: 'meses_cliente=38, score_churn=0,72, inadimplente=não', out: 'Linha 2: desconto por 6 meses, máximo de 20%.', rule: 'Elegibilidade de oferta de retenção v1.2.0 · linha 2', ms: 30 } },
        { id: 'cond', kind: 'logica.condicao', label: 'Elegível a oferta?', at: [3, 1], to: { sim: 'agente', 'não': 'resumo' },
          s: { in: 'oferta = Desconto por 6 meses', out: 'sim', ms: 15, take: 'sim' } },
        { id: 'agente', kind: 'agente.agente', label: 'Agente de retenção', at: [4, 0], componentId: 'tel-cp-agent-retencao', to: 'conteudo',
          s: { in: 'Motivo: preço; oferta elegível: até 20% por 6 meses', out: 'Proposta: 15% de desconto por 6 meses nas 6 linhas (economia de R$ 701,46) mantendo o plano PME-100.', rule: 'Agente de retenção 1.5.0', tok: 1240, ms: 1580 } },
        { id: 'conteudo', kind: 'guardrail.conteudo', label: 'Oferta dentro da elegibilidade', at: [5, 0], componentId: 'tel-cp-rule-retencao', to: 'pii',
          s: { in: 'Desconto proposto 15% ≤ máximo 20%', out: 'Oferta liberada.', rule: 'Oferta de retenção dentro da elegibilidade do plano 1.2.0', ms: 25 } },
        { id: 'pii', kind: 'guardrail.pii', label: 'Filtro de PII', at: [6, 0], componentId: 'tel-cp-hook-pii', to: 'responder',
          s: { in: 'Resposta com nome completo e CNPJ', out: 'Nome reduzido a "Marcos"; nenhum documento na resposta.', rule: 'Mascarar PII antes de enviar ao canal 1.3.0', ms: 35 } },
        { id: 'responder', kind: 'saida.responder', label: 'Responder no canal', at: [7, 0], channelId: 'tel-ch-portal',
          s: { in: 'Proposta liberada', out: 'Marcos, antes de cancelar: consigo 15% de desconto nas suas 6 linhas por 6 meses, mantendo o plano atual. Se preferir seguir com o cancelamento, faço agora mesmo.', ms: 210 } },
        { id: 'resumo', kind: 'agente.resumir', label: 'Resumir motivo do cancelamento', at: [4, 2], componentId: 'tel-cp-skill-resumo', to: 'transbordo',
          s: { in: 'Histórico da conversa', out: 'Motivo: preço. Sem oferta elegível. Cliente aguarda confirmação do cancelamento.', tok: 380, ms: 540 } },
        { id: 'transbordo', kind: 'pessoas.transbordo', label: 'Transbordo para retenção humana', at: [5, 2],
          s: { in: 'Resumo do caso', out: 'Conversa enviada à fila Retenção PME.', ms: 120 } },
      ],
      versions: [
        { version: '1.0.0', daysAgo: 75, author: 'champion', note: 'Primeira versão em produção.', drop: ['conteudo', 'resumo'] },
        { version: '1.1.0', daysAgo: 32, author: 'engenheiro_ai', note: 'Inclui guardrail de elegibilidade antes da resposta.', drop: ['resumo'] },
        { version: '1.2.0', daysAgo: 4, author: 'engenheiro_ai', note: 'Resume o motivo antes do transbordo humano.' },
      ],
      envVersions: { dev: '1.2.0', hml: '1.2.0', prd: '1.1.0' },
    },
    {
      id: J.auto, name: 'Diagnóstico técnico e abertura de OS', type: 'automacao', domainId: D.os, initiativeId: 'tel-in-04',
      description: 'Automação sem agente: verifica a rede, prioriza pela tabela do cérebro e abre a OS no ITSM.',
      triggerLabel: 'Reclamação de falha', risk: 'autonoma',
      brainInputs: ['Status de rede', 'Inventário', 'ITSM'],
      persona: { name: 'Evento da URA', message: 'Reclamação de falha: cliente CLI-118230 (PME) sem internet desde 03h10.' },
      kpis: ['Tempo até a OS', 'OS indevidas em falha massiva'],
      testCases: [
        ['Falha massiva', 'Reclamação em região com falha massiva', 'Avisa a previsão e não abre OS', 'passou'],
        ['PME sem serviço há 6 h', 'Reclamação PME sem falha massiva', 'Abre OS P2 com SLA de 8 horas', 'passou'],
      ],
      nodes: [
        { id: 'gat', kind: 'gatilho.api', label: 'Reclamação de falha', at: [0, 0], channelId: 'tel-ch-ura', to: 'rede',
          s: { in: '{"cliente_id":"CLI-118230","tipo":"sem sinal","desde":"03:10"}', out: 'Reclamação RC-552019 recebida da URA.', ms: 30 } },
        { id: 'rede', kind: 'dados.tool', label: 'Consultar status de rede', at: [1, 0], toolId: 'tel-tl-status-rede', contractId: 'tel-ct-rede', to: 'cond',
          s: { in: 'celula_id=CEL-30417', out: 'Célula operando; sem falha massiva na região.', src: 'Contrato Status de rede v2.0.0', ms: 180 } },
        { id: 'cond', kind: 'logica.condicao', label: 'Falha massiva na região?', at: [2, 0], to: { sim: 'aviso-massiva', 'não': 'prioridade' },
          s: { in: 'falha_massiva = false', out: 'não', ms: 10, take: 'não' } },
        { id: 'aviso-massiva', kind: 'saida.notificar', label: 'Avisar falha massiva', at: [3, 0], to: 'fim',
          s: { in: 'Previsão de normalização', out: 'Aviso enviado com a previsão de normalização.', ms: 150 } },
        { id: 'prioridade', kind: 'logica.tabela', label: 'Prioridade da OS', at: [3, 1], ruleId: 'tel-dt-prioridade-os', to: 'os',
          s: { in: 'segmento=PME, horas_sem_servico=6', out: 'Linha 1: prioridade P2, SLA de 8 horas.', rule: 'Prioridade de ordem de serviço v1.0.0 · linha 1', ms: 20 } },
        { id: 'os', kind: 'saida.itsm', label: 'Abrir OS no ITSM', at: [4, 1], toolId: 'tel-tl-criar-chamado', to: 'protocolo',
          s: { in: 'OS de reparo P2', out: 'OS WO0091544 aberta; técnico agendado até 16h.', ms: 1320 } },
        { id: 'protocolo', kind: 'saida.notificar', label: 'Enviar protocolo da OS', at: [5, 1], to: 'fim',
          s: { in: 'WO0091544', out: 'Protocolo e janela de visita enviados por SMS.', ms: 140 } },
        { id: 'fim', kind: 'saida.encerrar', label: 'Encerrar', at: [6, 1], s: { in: 'Fluxo concluído', out: 'Encerrado.', ms: 5 } },
      ],
      versions: [
        { version: '0.9.0', daysAgo: 21, author: 'engenheiro_ai', note: 'Primeira automação com abertura de OS.', drop: ['prioridade'] },
        { version: '1.0.0', daysAgo: 5, author: 'engenheiro_ai', note: 'Prioridade passa a vir da tabela do cérebro.' },
      ],
      envVersions: { dev: '1.0.0', hml: '1.0.0', prd: null },
    },
  ];

  const initiatives: IndustryContent['initiatives'] = [
    {
      id: 'tel-in-01', title: 'Cliente PME tira segunda via e contesta fatura pelo WhatsApp', type: 'nova_jornada', domainId: D.fatura, owner: u('dono_negocio'),
      stage: 'ideia', expectedValueBRL: 2400000, health: 'ok', journeyId: J.anchor,
      problem: '38 mil ligações por mês na URA são de segunda via ou contestação de fatura PME, com espera média de 11 minutos.',
      objective: 'Resolver segunda via e contestações simples no WhatsApp, sem atendente.',
      metric: 'Resolução no primeiro contato PME de 58% para 75%',
      validation: {
        checks: [
          { key: 'estrategia', label: 'Estratégia', result: 'verde', summary: 'Move o OKR "Elevar a resolução no primeiro contato PME para 75%" e o de digitalização do atendimento de fatura.', source: 'Empresa · OKRs 2026' },
          { key: 'mercado', label: 'Mercado e regulação', result: 'verde', summary: 'Quatro de cinco operadoras já têm segunda via no WhatsApp; contestação digital ainda é diferencial. Protocolo obrigatório em todo atendimento.', source: 'Mercado · Benchmark de atendimento digital (set/2026)' },
          { key: 'regras', label: 'Regras de negócio', result: 'verde', summary: 'Usa a tabela "Contestação de fatura" v3.0.0 sem alterações.', source: 'Regras de negócio · Contestação de fatura' },
          { key: 'dados', label: 'Dados', result: 'amarelo', summary: 'Contrato Fatura v2.0.0 cobre a segunda via. Lacuna de dado: o motivo da contestação não existe como campo estruturado no billing.', source: 'Dados · Contrato Fatura' },
          { key: 'integracoes', label: 'Integrações e canais', result: 'amarelo', summary: 'Billing e ITSM conectados (ITSM com latência degradada). WhatsApp configurado, ainda sem jornada vinculada.', source: 'Conectores e Canais' },
          { key: 'arquitetura', label: 'Arquitetura', result: 'verde', summary: 'Padrão "Agente com recuperação e tools"; solução do tipo agente, risco supervisionado.', source: 'Arquitetura · Arquitetura de referência' },
          { key: 'reuso', label: 'Reuso', result: 'verde', summary: '70% de reuso: Agente de atendimento PME, Calcular segunda via, Regra de contestação, Mascarar PII e MCP do Billing BSS.', source: 'Catálogo · Pacote Atendimento Digital 2.1' },
          { key: 'business_case', label: 'Business case', result: 'verde', summary: 'R$ 2,4 milhões por ano: 38 mil contatos/mês a R$ 5,20, com 60% migrando para o digital (premissas editáveis).', source: 'Telemetria · custo por contato da URA' },
        ],
        recommendation: 'O cérebro indica seguir com a iniciativa como jornada agêntica supervisionada, reaproveitando o Pacote Atendimento Digital 2.1. Recomendamos avaliar, antes da construção, a lacuna do motivo de contestação no billing.',
        attention: ['Lacuna de dado: motivo da contestação não estruturado no billing', 'Conector do ITSM com latência degradada', 'Dado pessoal (CPF) chega ao canal: exigir filtro de PII'],
        reusePct: 70, solutionType: 'agente',
      },
    },
    { id: 'tel-in-02', title: 'Portabilidade numérica assistida por agente', type: 'agente_ia', domainId: D.contrato, owner: u('dono_negocio'), stage: 'ideia', expectedValueBRL: 900000, health: 'ok',
      problem: 'Pedidos de portabilidade PME levam 4 dias por falta de documentos.', objective: 'Agente que confere documentos e agenda a portabilidade.', metric: 'Tempo de portabilidade de 4 para 2 dias' },
    { id: 'tel-in-03', title: 'Oferta de fibra para clientes móveis PME', type: 'novo_produto', domainId: D.oferta, owner: u('dono_negocio'), stage: 'validacao', expectedValueBRL: 3100000, health: 'atencao',
      problem: 'Só 12% dos clientes móveis PME têm fibra da Onda.', objective: 'Oferta combinada no momento da segunda via.', metric: 'Penetração de fibra na base PME de 12% para 20%' },
    { id: 'tel-in-04', title: 'Diagnóstico técnico e abertura de OS automática', type: 'eficiencia', domainId: D.os, owner: u('champion'), stage: 'construcao', expectedValueBRL: 1350000, health: 'ok', journeyId: J.auto,
      problem: '22% das OS são abertas durante falhas massivas e depois canceladas.', objective: 'Checar a rede antes de abrir OS e priorizar pela regra.', metric: 'OS indevidas de 22% para 5%',
      validation: { checks: [], recommendation: 'O cérebro indica seguir como automação sem agente.', attention: [], reusePct: 55, solutionType: 'automacao', decision: 'seguir' } },
    { id: 'tel-in-05', title: 'Retenção com oferta personalizada', type: 'agente_ia', domainId: D.oferta, owner: u('dono_negocio'), stage: 'operacao', expectedValueBRL: 4200000, health: 'ok', journeyId: J.prd,
      problem: 'Ofertas de retenção dadas fora da regra geravam desconto excessivo e reclamações.', objective: 'Oferta elegível e personalizada em todo pedido de cancelamento.', metric: 'Churn PME de 2,4% para 1,6% ao mês',
      validation: { checks: [], recommendation: 'O cérebro indica seguir com guardrail de elegibilidade obrigatório.', attention: ['Manter a tabela de elegibilidade atualizada a cada campanha'], reusePct: 62, solutionType: 'agente', decision: 'seguir' } },
    { id: 'tel-in-06', title: 'Modernização da URA com voz natural', type: 'modernizacao', domainId: D.cliente, owner: u('champion'), stage: 'prototipo', expectedValueBRL: 1800000, health: 'atencao',
      problem: 'Menu da URA com 9 opções e 34% de abandono.', objective: 'Entrada por voz natural ligada às mesmas jornadas do WhatsApp.', metric: 'Abandono na URA de 34% para 18%' },
    { id: 'tel-in-07', title: 'Cobrança preventiva de PME inadimplente', type: 'eficiencia', domainId: D.fatura, owner: u('dono_negocio'), stage: 'validacao', expectedValueBRL: 750000, health: 'risco',
      problem: 'Inadimplência PME de 6,1% com contato apenas após 30 dias.', objective: 'Lembrete e acordo antes do vencimento.', metric: 'Inadimplência PME de 6,1% para 4,5%' },
    { id: 'tel-in-08', title: 'Painel de saúde de rede para o backoffice', type: 'modernizacao', domainId: D.rede, owner: u('champion'), stage: 'construcao', expectedValueBRL: 420000, health: 'ok',
      problem: 'Atendentes não sabem de falhas massivas em tempo real.', objective: 'Painel com status por região alimentado pelo lakehouse.', metric: 'Tempo médio de atendimento técnico de 14 para 9 minutos' },
    { id: 'tel-in-09', title: 'Agente interno para técnicos de campo', type: 'agente_ia', domainId: D.os, owner: u('champion'), stage: 'prototipo', expectedValueBRL: 610000, health: 'ok',
      problem: 'Técnicos ligam para o suporte para consultar inventário.', objective: 'Agente no Teams com inventário e procedimentos.', metric: 'Visitas resolvidas na primeira ida de 71% para 85%' },
  ];

  const policies: IndustryContent['policies'] = [
    { id: 'tel-pol-retencao', name: 'Oferta de retenção dentro da elegibilidade do plano', kind: 'jornada', description: 'Nenhum agente oferece desconto ou plano fora da tabela de elegibilidade vigente.', condition: 'quando a oferta proposta exceder a elegibilidade do cliente', effect: 'bloquear', envs: ['dev', 'hml', 'prd'], active: true,
      code: JSON.stringify({ policy: 'retencao-elegivel', when: { node: 'agente.agente', output: { 'oferta.desconto': { gt: 'elegibilidade.desconto_max' } } }, then: 'bloquear' }, null, 2) },
    { id: 'tel-pol-contestacao', name: 'Contestação acima de R$ 500 exige analista', kind: 'jornada', description: 'A tool abrir_contestacao só conclui sozinha até R$ 500; acima disso, exige aprovação humana.', condition: 'quando o valor contestado passar de R$ 500', effect: 'exigir_aprovacao', envs: ['prd'], active: true,
      code: JSON.stringify({ policy: 'contestacao-alcada', when: { tool: 'abrir_contestacao', input: { valor: { gt: 500 } } }, then: { exigir_aprovacao: ['dono_negocio'] } }, null, 2) },
  ];

  return {
    workspace: { id: 'ws-telecom', industry: 'telecom', company: 'Onda Telecom', segment: 'Operadora fixa e móvel', tagline: 'Conectividade simples para pessoas e pequenas empresas',
      description: 'Operadora fictícia com 3,2 milhões de linhas móveis, 410 mil acessos de fibra e 48 mil clientes PME. Atende por WhatsApp, URA, Portal PME e backoffice.' },
    userDomains: { dono_negocio: [D.fatura, D.cliente, D.oferta], champion: [D.cliente, D.contrato, D.fatura, D.os, D.rede, D.oferta], engenheiro_ai: [D.fatura, D.os], engenheiro_dados: Object.values(D), seguranca: [D.cliente], patrocinador: [D.cliente, D.fatura] },
    systems, connectors, channels, domains, contracts, tables, sqlExamples,
    lineage: [
      ['tel-con-billing', 'tel-tb-brz-faturas'], ['tel-con-billing', 'tel-tb-brz-clientes'],
      ['tel-tb-brz-faturas', 'tel-tb-prt-faturas'], ['tel-tb-brz-clientes', 'tel-tb-prt-clientes'],
      ['tel-tb-prt-faturas', 'tel-tb-our-fatura'], ['tel-tb-prt-clientes', 'tel-tb-our-perfil'],
      ['tel-tb-our-fatura', 'tel-ct-fatura'], ['tel-tb-our-perfil', 'tel-ct-cliente'],
      ['tel-ct-fatura', J.anchor], ['tel-ct-cliente', J.prd], ['tel-ct-cliente', J.anchor],
      [J.anchor, 'tel-ch-whatsapp'], [J.prd, 'tel-ch-portal'],
    ],
    collections, documents, retrievals, knowledgeGraph,
    coverage: [78, 64, 71, 58, 82, 66, 74, 61, 35, 28],
    artifacts, decisionTables, components, journeys, initiatives, policies,
    kpis: [
      { name: 'Resolução no primeiro contato', unit: '%', baseline: 58, current: 69, target: 75, better: 'up' },
      { name: 'Tempo médio de atendimento', unit: 'min', baseline: 11.5, current: 8.2, target: 7, better: 'down' },
      { name: 'Churn PME', unit: '% ao mês', baseline: 2.4, current: 1.9, target: 1.6, better: 'down' },
      { name: 'NPS', unit: 'pontos', baseline: 21, current: 34, target: 40, better: 'up' },
    ],
    guardrail: 'Oferta de retenção fora da elegibilidade do plano',
    dailyVolume: 5200,
    suggestions: ({ journeys: js }) => {
      const prdJ = js.find((j) => j.id === J.prd)!;
      return [
        { id: 'tel-sg-1', kind: 'skill', title: 'Criar skill "Explicar multa de cancelamento"', status: 'nova', journeyId: J.prd, sourceDocId: 'tel-doc-retencao',
          evidence: `32% dos transbordos da jornada ${prdJ.name} ocorrem na mesma pergunta ("posso cancelar sem multa?"); criar skill a partir do documento Política de retenção PME 2026?`,
          proposal: 'Skill que calcula a multa proporcional pelos meses restantes de fidelidade e explica em linguagem simples, citando a política.' },
        { id: 'tel-sg-2', kind: 'regra', title: 'Regra para contestação de roaming', status: 'nova', journeyId: J.anchor, sourceDocId: 'tel-doc-contestacao',
          evidence: '18% das contestações de teste citam roaming e caem na linha 7 (transbordo) da tabela de contestação.',
          proposal: 'Adicionar a linha "roaming não utilizado" à tabela Contestação de fatura, com análise automática até R$ 200.' },
        { id: 'tel-sg-3', kind: 'skill', title: 'Skill de previsão de normalização', status: 'aceita', journeyId: J.auto, sourceDocId: 'tel-doc-diagnostico',
          evidence: '41% das reclamações em falha massiva voltam a ligar pedindo previsão.', proposal: 'Skill que informa a previsão de normalização a partir do status de rede.' },
      ];
    },
  };
}

// Evita aviso de import não usado em algumas configurações.
void ts;
