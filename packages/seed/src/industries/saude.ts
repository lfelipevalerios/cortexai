// Rede Sanare: rede hospitalar (empresa fictícia). Operadoras citadas também são fictícias.
import type { Channel, DataDomain, DecisionTable, EcosystemSystem } from '@cortex/schemas';
import type { IndustryContent, IndustryMeta, Ctx } from '../common';
import { connector, contract, obj, table, dateAgo, okValidation } from '../common';

const W = 'sau';
export const meta: IndustryMeta = {
  industry: 'saude', p: W, ws: 'ws-saude', seed: 0x5a0de,
  people: {
    patrocinador: 'Beatriz Almeida', dono_negocio: 'Eduardo Ferraz', champion: 'Natália Barbosa', engenheiro_ai: 'Caio Machado',
    engenheiro_dados: 'Renata Cardoso', coe: 'Gabriel Teixeira', seguranca: 'Débora Xavier', admin: 'Igor Pacheco',
  },
  coreName: 'Faturamento TISS', coreConnectorId: 'sau-con-tiss', org: 'rede-sanare', repo: 'jornadas-paciente',
};

export const DEMO = {
  anchorJourneyId: 'sau-jr-agendamento', prdJourneyId: 'sau-jr-glosa', anchorInitiativeId: 'sau-in-01',
  whatsappChannelId: 'sau-ch-whatsapp', showcaseDecisionTableId: 'sau-dt-cobertura',
  showcaseQuestion: 'ressonância magnética precisa de pré-autorização da operadora?', crmSystemId: 'sau-sys-crm',
};
export const BREAKING = { contractId: 'sau-ct-paciente', field: 'carteirinha' };

export function crmPreset(ctx: Ctx) {
  return {
    typeId: 'dynamics365', name: 'CRM de relacionamento (Dynamics 365)', domainId: 'sau-dom-paciente',
    endpoint: 'https://redesanare.crm.dynamics.example/api/data/v9.2',
    objects: [
      obj(ctx, 'Paciente (contact)', 'objeto', 286400, [['id', 'string', 'id:PAC-'], ['nome', 'string', 'nome'], ['cpf', 'string', 'cpf'], ['data_nascimento', 'date', 'nascimento'], ['email', 'string', 'email'], ['telefone', 'string', 'telefone'], ['operadora', 'string', 'enum:Vitta Saúde|Plena Care|Integra Planos|Particular']],
        { row0: { nome: 'Ana L******', cpf: '***.104.386-**', telefone: '(11) 9****-3307' } }),
      obj(ctx, 'Solicitação (incident)', 'objeto', 942100, [['id', 'string', 'id:SOL-'], ['paciente_id', 'string', 'id:PAC-'], ['assunto', 'string', 'enum:Agendamento|Autorização|Resultado de exame|Reclamação'], ['status', 'string', 'enum:Aberta|Resolvida|Em andamento'], ['criada_em', 'datetime', 'datahora:0:60']]),
      obj(ctx, 'Preferência de contato', 'objeto', 201300, [['paciente_id', 'string', 'id:PAC-'], ['canal', 'string', 'enum:WhatsApp|App|E-mail|Telefone'], ['consentimento', 'boolean', 'bool:0.81'], ['atualizado_em', 'datetime', 'datahora:0:200']]),
    ],
    tools: [
      { id: 'sau-tl-crm-consultar-paciente', name: 'consultar_paciente', description: 'Busca paciente pelo telefone ou CPF.', mode: 'leitura' as const, enabledByEnv: { dev: true, hml: true, prd: true } },
      { id: 'sau-tl-crm-preferencias', name: 'consultar_preferencias', description: 'Canal preferido e consentimentos do paciente.', mode: 'leitura' as const, enabledByEnv: { dev: true, hml: true, prd: true } },
      { id: 'sau-tl-crm-registrar-solicitacao', name: 'registrar_solicitacao', description: 'Registra solicitação de atendimento do paciente.', mode: 'escrita' as const, enabledByEnv: { dev: true, hml: true, prd: false } },
    ],
  };
}

export function build(ctx: Ctx): IndustryContent {
  const u = ctx.u;
  const D = {
    paciente: 'sau-dom-paciente', atendimento: 'sau-dom-atendimento', agenda: 'sau-dom-agenda', autorizacao: 'sau-dom-autorizacao',
    conta: 'sau-dom-conta', prestador: 'sau-dom-prestador', eventos: 'sau-dom-eventos', logs: 'sau-dom-logs',
  };
  const J = { anchor: 'sau-jr-agendamento', prd: 'sau-jr-glosa', auto: 'sau-jr-lembrete' };

  const connectors = [
    connector(ctx, {
      id: 'sau-con-fhir', typeId: 'hl7-fhir', name: 'HIS/PEP · HL7 FHIR', domainId: D.paciente, syncMode: 'cdc',
      volume: 286400, latencyMs: 280, consumers: [J.prd, 'sau-ct-paciente', 'sau-ct-atendimento'],
      endpoint: 'https://fhir-{env}.redesanare.example/fhir/R4',
      objects: [
        obj(ctx, 'Patient', 'endpoint', 286400, [['id', 'string', 'id:PAC-'], ['nome', 'string', 'nome'], ['cpf', 'string', 'cpf'], ['nascimento', 'date', 'nascimento'], ['telefone', 'string', 'telefone'], ['carteirinha', 'string', 'id:CART-']],
          { row0: { nome: 'Ana L******', cpf: '***.104.386-**', telefone: '(11) 9****-3307' } }),
        obj(ctx, 'Encounter', 'endpoint', 1840200, [['id', 'string', 'id:ENC-'], ['paciente_id', 'string', 'id:PAC-'], ['tipo', 'string', 'enum:ambulatorial|internação|pronto atendimento'], ['unidade', 'string', 'enum:Sanare Paulista|Sanare Campinas|Sanare Moema'], ['inicio', 'datetime', 'datahora:0:90']]),
        obj(ctx, 'ServiceRequest', 'endpoint', 612800, [['id', 'string', 'id:SR-'], ['paciente_id', 'string', 'id:PAC-'], ['exame', 'string', 'enum:Ressonância magnética|Tomografia|Ultrassonografia|Hemograma'], ['solicitante_crm', 'string', 'id:CRM-SP '], ['status', 'string', 'enum:ativo|concluído']]),
      ],
      tools: [
        ['sau-tl-buscar-paciente', 'buscar_paciente', 'Localiza o paciente e retorna carteirinha e operadora.', 'leitura'],
        ['sau-tl-historico-exames', 'historico_exames', 'Lista exames realizados nos últimos 24 meses.', 'leitura'],
      ],
    }),
    connector(ctx, {
      id: 'sau-con-tiss', typeId: 'tiss', name: 'Faturamento · TISS', domainId: D.conta, syncMode: 'agendado',
      volume: 734000, latencyMs: 540, consumers: [J.anchor, J.prd, 'sau-ct-conta', 'sau-ct-autorizacao'],
      endpoint: 'https://tiss-{env}.redesanare.example/ws/v4',
      objects: [
        obj(ctx, 'Guia SP/SADT', 'objeto', 734000, [['numero_guia', 'string', 'id:G-'], ['carteirinha', 'string', 'id:CART-'], ['operadora', 'string', 'enum:Vitta Saúde|Plena Care|Integra Planos'], ['procedimento', 'string', 'enum:Ressonância de joelho|Tomografia de tórax|Ultrassom abdominal'], ['status', 'string', 'enum:autorizada|em análise|negada']]),
        obj(ctx, 'Lote de cobrança', 'objeto', 41200, [['lote_id', 'string', 'id:LT-'], ['operadora', 'string', 'enum:Vitta Saúde|Plena Care|Integra Planos'], ['contas', 'integer', 'int:20:400'], ['valor_total', 'decimal', 'valor:20000:900000'], ['enviado_em', 'date', 'data:0:60']]),
        obj(ctx, 'Demonstrativo de glosa', 'objeto', 96300, [['demonstrativo_id', 'string', 'id:DG-'], ['lote_id', 'string', 'id:LT-'], ['motivo', 'string', 'enum:Falta de autorização|Item não coberto|Valor acima da tabela|Duplicidade'], ['valor_glosado', 'decimal', 'valor:80:24000']]),
      ],
      tools: [
        ['sau-tl-solicitar-autorizacao', 'solicitar_autorizacao', 'Envia pedido de autorização à operadora com a guia SP/SADT.', 'escrita'],
        ['sau-tl-consultar-guia', 'consultar_guia', 'Consulta o status de uma guia na operadora.', 'leitura'],
        ['sau-tl-enviar-lote', 'enviar_lote', 'Envia o lote de contas para a operadora.', 'escrita', 'sau-pol-modelo-br'],
      ],
    }),
    connector(ctx, {
      id: 'sau-con-agenda', typeId: 'rest-openapi', name: 'Agenda de exames · API', domainId: D.agenda, syncMode: 'sob_demanda',
      volume: 58200, latencyMs: 210, consumers: [J.anchor, J.auto, 'sau-ct-agenda'],
      endpoint: 'https://agenda-{env}.redesanare.example/v2',
      objects: [
        obj(ctx, 'GET /horarios', 'endpoint', 58200, [['horario_id', 'string', 'id:H-'], ['unidade', 'string', 'enum:Sanare Paulista|Sanare Campinas|Sanare Moema'], ['exame', 'string', 'enum:Ressonância magnética|Tomografia|Ultrassonografia'], ['inicio', 'datetime', 'datahora:0:10'], ['livre', 'boolean', 'bool:0.6']]),
        obj(ctx, 'GET /agendamentos', 'endpoint', 412000, [['agendamento_id', 'string', 'id:AG-'], ['paciente', 'string', 'nome'], ['telefone', 'string', 'telefone'], ['horario_id', 'string', 'id:H-'], ['status', 'string', 'enum:marcado|confirmado|faltou|realizado']]),
      ],
      tools: [
        ['sau-tl-consultar-horarios', 'consultar_horarios', 'Horários livres por exame, unidade e data.', 'leitura'],
        ['sau-tl-reservar-horario', 'reservar_horario', 'Reserva o horário para o paciente.', 'escrita'],
        ['sau-tl-confirmar', 'confirmar_agendamento', 'Marca o agendamento como confirmado.', 'escrita'],
        ['sau-tl-liberar-horario', 'liberar_horario', 'Cancela a reserva e devolve o horário à agenda.', 'escrita'],
      ],
    }),
    connector(ctx, {
      id: 'sau-con-erp', typeId: 'totvs-protheus', name: 'ERP · TOTVS Protheus', domainId: D.prestador, syncMode: 'agendado',
      volume: 18400, latencyMs: 460, consumers: ['sau-ct-prestador'],
      endpoint: 'https://erp-{env}.redesanare.example/rest',
      objects: [
        obj(ctx, 'Tabela de preços', 'tabela', 18400, [['codigo', 'string', 'id:TP-'], ['descricao', 'string', 'enum:Diária de apartamento|Ressonância magnética|Kit de curativo|Honorário cirúrgico'], ['operadora', 'string', 'enum:Vitta Saúde|Plena Care|Integra Planos'], ['valor', 'decimal', 'valor:12:4800']]),
        obj(ctx, 'Prestadores', 'tabela', 2310, [['prestador_id', 'string', 'id:PR-'], ['nome', 'string', 'nome'], ['crm', 'string', 'id:CRM-SP '], ['especialidade', 'string', 'enum:Ortopedia|Cardiologia|Radiologia|Clínica médica']]),
      ],
      tools: [['sau-tl-tabela-preco', 'consultar_tabela_preco', 'Preço contratado do item por operadora.', 'leitura']],
    }),
    connector(ctx, {
      id: 'sau-con-lab', typeId: 'sqlserver', name: 'Laboratório · LIS', status: 'degradado', domainId: D.atendimento, syncMode: 'cdc',
      volume: 3920000, latencyMs: 1380, consumers: ['sau-ct-atendimento'],
      endpoint: 'sqlserver://lis-{env}.redesanare.example:1433/lis',
      objects: [
        obj(ctx, 'dbo.resultados', 'tabela', 3920000, [['resultado_id', 'string', 'id:RS-'], ['paciente_id', 'string', 'id:PAC-'], ['exame', 'string', 'enum:Hemograma|Glicemia|TSH|Creatinina'], ['liberado_em', 'datetime', 'datahora:0:30'], ['critico', 'boolean', 'bool:0.03']]),
        obj(ctx, 'dbo.coletas', 'tabela', 1210000, [['coleta_id', 'string', 'id:CO-'], ['paciente_id', 'string', 'id:PAC-'], ['unidade', 'string', 'enum:Sanare Paulista|Sanare Campinas|Sanare Moema'], ['coletado_em', 'datetime', 'datahora:0:30']]),
      ],
      tools: [['sau-tl-status-resultado', 'status_resultado', 'Informa se o resultado está liberado, sem conteúdo clínico.', 'leitura']],
    }),
  ];

  const channels: Channel[] = [
    { id: 'sau-ch-whatsapp', type: 'whatsapp', name: 'WhatsApp Sanare', status: 'ativo', config: { numero: '+55 11 4000-0101', templates: 'confirmacao_exame, preparo_exame', optin: 'obrigatório', horario: '24 horas' }, journeyByEnv: {} },
    { id: 'sau-ch-app', type: 'app', name: 'App do paciente', status: 'ativo', config: { sdk: 'cortex-sdk 2.4', notificacoes: 'push e in-app' }, journeyByEnv: { dev: J.auto, hml: J.auto } },
    { id: 'sau-ch-portal', type: 'webchat', name: 'Portal do médico', status: 'ativo', config: { cor: '#A07EFC', boasVindas: 'Olá, doutor(a). Como posso ajudar?', acesso: 'login com CRM' }, journeyByEnv: { dev: J.prd, hml: J.prd, prd: J.prd } },
    { id: 'sau-ch-backoffice', type: 'backoffice', name: 'Backoffice de faturamento', status: 'ativo', config: { fila: 'Auditoria de contas', sugestoes: 'ativadas' }, journeyByEnv: { dev: J.prd, hml: J.prd, prd: J.prd } },
  ];

  const systems: EcosystemSystem[] = [
    { id: 'sau-sys-crm', name: 'CRM de relacionamento', category: 'crm' },
    { id: 'sau-sys-his', name: 'HIS/PEP', category: 'setorial', connectorId: 'sau-con-fhir' },
    { id: 'sau-sys-tiss', name: 'Faturamento TISS', category: 'setorial', connectorId: 'sau-con-tiss' },
    { id: 'sau-sys-agenda', name: 'Agenda', category: 'api', connectorId: 'sau-con-agenda' },
    { id: 'sau-sys-erp', name: 'ERP', category: 'erp', connectorId: 'sau-con-erp' },
    { id: 'sau-sys-lab', name: 'Laboratório', category: 'banco', connectorId: 'sau-con-lab' },
    { id: 'sau-sys-whatsapp', name: 'WhatsApp', category: 'canal' },
    { id: 'sau-sys-app', name: 'App do paciente', category: 'canal' },
    { id: 'sau-sys-portal', name: 'Portal do médico', category: 'canal' },
    { id: 'sau-sys-backoffice', name: 'Backoffice de faturamento', category: 'canal' },
  ];

  const domains: DataDomain[] = [
    { id: D.paciente, name: 'Paciente', kind: 'negocio', owner: u('dono_negocio'), description: 'Cadastro, carteirinha, operadora e consentimentos do paciente.', entities: ['Paciente', 'Carteirinha', 'Consentimento'], relations: [D.atendimento, D.agenda, D.autorizacao], products: ['sau-tb-our-paciente'], consumers: [J.prd, J.anchor], position: { x: 0, y: 0 } },
    { id: D.atendimento, name: 'Atendimento', kind: 'negocio', owner: u('champion'), description: 'Consultas, internações e exames realizados.', entities: ['Atendimento', 'Exame', 'Resultado'], relations: [D.paciente, D.conta, D.prestador], products: [], consumers: [], position: { x: 300, y: 0 } },
    { id: D.agenda, name: 'Agenda', kind: 'negocio', owner: u('dono_negocio'), description: 'Horários, reservas, confirmações e faltas.', entities: ['Horário', 'Agendamento'], relations: [D.paciente, D.autorizacao], products: ['sau-tb-our-agenda'], consumers: [J.anchor, J.auto], position: { x: 600, y: 0 } },
    { id: D.autorizacao, name: 'Autorização', kind: 'negocio', owner: u('dono_negocio'), description: 'Pedidos de autorização às operadoras e seus prazos.', entities: ['Guia', 'Autorização'], relations: [D.paciente, D.agenda, D.conta], products: [], consumers: [J.anchor], position: { x: 0, y: 240 } },
    { id: D.conta, name: 'Conta e glosa', kind: 'negocio', owner: u('dono_negocio'), description: 'Contas hospitalares, lotes TISS e glosas das operadoras.', entities: ['Conta', 'Lote', 'Glosa'], relations: [D.atendimento, D.autorizacao, D.prestador], products: ['sau-tb-our-glosa'], consumers: [J.prd], position: { x: 300, y: 240 } },
    { id: D.prestador, name: 'Prestador', kind: 'negocio', owner: u('champion'), description: 'Médicos, unidades e tabelas de preço por operadora.', entities: ['Médico', 'Unidade', 'Tabela de preço'], relations: [D.atendimento, D.conta], products: [], consumers: [], position: { x: 600, y: 240 } },
    { id: D.eventos, name: 'Eventos', kind: 'tecnico', owner: u('engenheiro_dados'), description: 'Eventos de fechamento de conta e mudanças no PEP.', entities: ['Evento de conta', 'Evento clínico'], relations: [D.conta], products: [], consumers: [J.prd], position: { x: 900, y: 80 } },
    { id: D.logs, name: 'Logs', kind: 'tecnico', owner: u('engenheiro_dados'), description: 'Traces das jornadas, auditoria e telemetria do Claude Code.', entities: ['Trace', 'Evento de auditoria'], relations: [D.eventos], products: [], consumers: [], position: { x: 900, y: 360 } },
  ];

  const contracts = [
    contract(ctx, {
      id: 'sau-ct-paciente', name: 'Contrato Paciente', domainId: D.paciente, entity: 'Paciente', owner: u('engenheiro_dados'),
      fields: [
        ['paciente_id', 'string', true, 'interno', 'Identificador do paciente no HIS.'],
        ['nome', 'string', true, 'pii', 'Nome civil.'],
        ['nome_social', 'string', false, 'pii', 'Nome social, quando informado.'],
        ['cpf', 'string', true, 'pii', 'CPF do paciente.'],
        ['data_nascimento', 'date', true, 'pii', 'Data de nascimento.'],
        ['telefone', 'string', true, 'pii', 'Celular usado no WhatsApp.'],
        ['operadora_id', 'string', true, 'interno', 'Operadora do plano.'],
        ['carteirinha', 'string', true, 'sensivel', 'Número da carteirinha do plano; usado nas guias e contas.'],
        ['consentimento_whatsapp', 'boolean', false, 'interno', 'Aceite para contato pelo WhatsApp.'],
      ],
      addedInV2: ['nome_social', 'consentimento_whatsapp'],
      removedInV2: [['telefone_fixo', 'string', false, 'pii', 'Telefone fixo legado.']],
      v2Note: 'Paciente v2: inclui nome social e consentimento de WhatsApp; remove telefone fixo.',
      freshness: '1h', expectedVolume: '280 mil a 300 mil pacientes',
    }),
    contract(ctx, {
      id: 'sau-ct-conta', name: 'Contrato Conta hospitalar', domainId: D.conta, entity: 'Conta', owner: u('engenheiro_dados'),
      fields: [
        ['conta_id', 'string', true, 'interno', 'Identificador da conta.'],
        ['atendimento_id', 'string', true, 'interno', 'Atendimento de origem.'],
        ['paciente_id', 'string', true, 'interno', 'Paciente.', 'Paciente.paciente_id'],
        ['operadora_id', 'string', true, 'interno', 'Operadora cobrada.'],
        ['valor_total', 'decimal', true, 'interno', 'Valor total da conta.'],
        ['itens', 'array', true, 'interno', 'Itens cobrados com código e quantidade.'],
        ['risco_glosa', 'decimal', false, 'interno', 'Probabilidade de glosa estimada.'],
      ],
      addedInV2: ['risco_glosa'], v2Note: 'Inclui risco de glosa calculado antes do envio.',
      freshness: '30min', expectedVolume: '2 mil contas por dia', faixa: ['valor_total', 'valor_total > 0'],
    }),
    contract(ctx, {
      id: 'sau-ct-agenda', name: 'Contrato Agenda', domainId: D.agenda, entity: 'Agendamento', owner: u('engenheiro_dados'),
      fields: [
        ['agendamento_id', 'string', true, 'interno', 'Identificador.'],
        ['paciente_id', 'string', true, 'interno', 'Paciente.', 'Paciente.paciente_id'],
        ['exame', 'string', true, 'interno', 'Exame ou consulta.'],
        ['unidade', 'string', true, 'publico', 'Unidade de atendimento.'],
        ['inicio', 'datetime', true, 'interno', 'Data e hora.'],
        ['status', 'string', true, 'interno', 'marcado, confirmado, faltou ou realizado.'],
        ['preparo_id', 'string', false, 'interno', 'Protocolo de preparo aplicável.'],
      ],
      addedInV2: ['preparo_id'], v2Note: 'Liga o agendamento ao protocolo de preparo.',
      freshness: '5min', expectedVolume: '14 mil agendamentos por dia',
    }),
    contract(ctx, {
      id: 'sau-ct-autorizacao', name: 'Contrato Autorização', domainId: D.autorizacao, entity: 'Autorização', owner: u('engenheiro_dados'),
      fields: [
        ['autorizacao_id', 'string', true, 'interno', 'Identificador.'],
        ['numero_guia', 'string', true, 'interno', 'Número da guia TISS.'],
        ['paciente_id', 'string', true, 'interno', 'Paciente.', 'Paciente.paciente_id'],
        ['procedimento', 'string', true, 'sensivel', 'Procedimento solicitado (revela condição de saúde).'],
        ['status', 'string', true, 'interno', 'autorizada, em análise ou negada.'],
        ['prazo_resposta', 'datetime', false, 'interno', 'Prazo informado pela operadora.'],
      ],
      addedInV2: ['prazo_resposta'], v2Note: 'Inclui prazo de resposta da operadora.',
      freshness: '15min', expectedVolume: '3 mil pedidos por dia',
    }),
    contract(ctx, {
      id: 'sau-ct-atendimento', name: 'Contrato Atendimento', domainId: D.atendimento, entity: 'Atendimento', owner: u('engenheiro_dados'),
      fields: [
        ['atendimento_id', 'string', true, 'interno', 'Identificador.'],
        ['paciente_id', 'string', true, 'interno', 'Paciente.', 'Paciente.paciente_id'],
        ['tipo', 'string', true, 'interno', 'Ambulatorial, internação ou pronto atendimento.'],
        ['cid', 'string', false, 'sensivel', 'Código de diagnóstico; nunca exposto a agentes de atendimento.'],
        ['medico_crm', 'string', true, 'interno', 'Médico responsável.'],
        ['inicio', 'datetime', true, 'interno', 'Início do atendimento.'],
      ],
      addedInV2: ['medico_crm'], v2Note: 'Inclui médico responsável.',
      freshness: '1h', expectedVolume: '6 mil atendimentos por dia', failing: true,
    }),
    contract(ctx, {
      id: 'sau-ct-prestador', name: 'Contrato Prestador', domainId: D.prestador, entity: 'Prestador', owner: u('engenheiro_dados'),
      fields: [
        ['prestador_id', 'string', true, 'interno', 'Identificador.'],
        ['nome', 'string', true, 'publico', 'Nome profissional.'],
        ['crm', 'string', true, 'publico', 'Registro profissional.'],
        ['especialidade', 'string', true, 'publico', 'Especialidade principal.'],
        ['unidades', 'array', false, 'publico', 'Unidades em que atende.'],
      ],
      addedInV2: ['unidades'], v2Note: 'Inclui unidades de atendimento.', versions: ['1.0.0', '1.1.0'],
      freshness: '24h', expectedVolume: '2,3 mil prestadores',
    }),
  ];

  const tables = [
    table(ctx, 'sau-tb-brz-patient', 'brz_fhir_patient', 'bronze', D.paciente, 286400, [['id', 'string', 'id:PAC-'], ['nome', 'string', 'nome'], ['cpf', 'string', 'cpf'], ['telefone', 'string', 'telefone'], ['payload_operadora', 'string', 'enum:VITTA|PLENA|INTEGRA|PART']], 1),
    table(ctx, 'sau-tb-brz-guias', 'brz_tiss_guias', 'bronze', D.autorizacao, 734000, [['numero_guia', 'string', 'id:G-'], ['carteirinha', 'string', 'id:CART-'], ['procedimento_raw', 'string', 'enum:RM JOELHO|TC TORAX|US ABD'], ['status_raw', 'string', 'enum:AUT|ANL|NEG'], ['recebido_em', 'timestamp', 'datahora:0:2']], 2),
    table(ctx, 'sau-tb-brz-contas', 'brz_tiss_contas', 'bronze', D.conta, 512400, [['conta_id', 'string', 'id:CT-'], ['operadora', 'string', 'enum:VITTA|PLENA|INTEGRA'], ['valor_total', 'string', 'valor:180:98000'], ['itens_json', 'string', 'const:[...]'], ['fechada_em', 'timestamp', 'datahora:0:3']], 2),
    table(ctx, 'sau-tb-prt-pacientes', 'prt_pacientes', 'prata', D.paciente, 285900, [['paciente_id', 'string', 'id:PAC-'], ['nome_hash', 'string', 'hash'], ['cpf_hash', 'string', 'hash'], ['operadora', 'string', 'enum:Vitta Saúde|Plena Care|Integra Planos|Particular'], ['faixa_etaria', 'string', 'enum:0-17|18-39|40-59|60+']], 2),
    table(ctx, 'sau-tb-prt-contas', 'prt_contas', 'prata', D.conta, 511700, [['conta_id', 'string', 'id:CT-'], ['operadora', 'string', 'enum:Vitta Saúde|Plena Care|Integra Planos'], ['valor_total', 'decimal', 'valor:180:98000'], ['qtd_itens', 'integer', 'int:3:180'], ['tem_autorizacao', 'boolean', 'bool:0.88']], 3),
    table(ctx, 'sau-tb-prt-agenda', 'prt_agendamentos', 'prata', D.agenda, 411600, [['agendamento_id', 'string', 'id:AG-'], ['exame', 'string', 'enum:Ressonância magnética|Tomografia|Ultrassonografia'], ['unidade', 'string', 'enum:Sanare Paulista|Sanare Campinas|Sanare Moema'], ['status', 'string', 'enum:marcado|confirmado|faltou|realizado']], 1),
    table(ctx, 'sau-tb-our-paciente', 'our_paciente_360', 'ouro', D.paciente, 285900, [['paciente_id', 'string', 'id:PAC-'], ['operadora', 'string', 'enum:Vitta Saúde|Plena Care|Integra Planos'], ['carteirinha', 'string', 'id:CART-'], ['canal_preferido', 'string', 'enum:WhatsApp|App|Telefone'], ['consentimento_whatsapp', 'boolean', 'bool:0.8']], 3),
    table(ctx, 'sau-tb-our-glosa', 'our_glosa_por_operadora', 'ouro', D.conta, 1440, [['operadora', 'string', 'enum:Vitta Saúde|Plena Care|Integra Planos'], ['mes', 'date', 'enum:2026-08-01|2026-09-01|2026-10-01'], ['taxa_glosa_pct', 'decimal', 'pct:3:9'], ['valor_glosado', 'decimal', 'valor:40000:610000'], ['motivo_principal', 'string', 'enum:Falta de autorização|Item não coberto|Valor acima da tabela']], 6),
    table(ctx, 'sau-tb-our-agenda', 'our_disponibilidade_exames', 'ouro', D.agenda, 6200, [['unidade', 'string', 'enum:Sanare Paulista|Sanare Campinas|Sanare Moema'], ['exame', 'string', 'enum:Ressonância magnética|Tomografia|Ultrassonografia'], ['proximo_horario', 'datetime', 'datahora:0:5'], ['ocupacao_pct', 'decimal', 'pct:55:98']], 1),
  ];

  const sqlExamples = [
    { id: 'sau-sql-1', question: 'Qual a taxa de glosa por operadora em outubro?', sql: "SELECT operadora, taxa_glosa_pct, valor_glosado\nFROM our_glosa_por_operadora\nWHERE mes = DATE '2026-10-01'\nORDER BY taxa_glosa_pct DESC;", columns: ['operadora', 'taxa_glosa_pct', 'valor_glosado'], rows: [['Plena Care', 6.8, 412300], ['Integra Planos', 5.2, 238900], ['Vitta Saúde', 3.9, 187400]] },
    { id: 'sau-sql-2', question: 'Quantas contas abertas ainda não têm autorização?', sql: 'SELECT operadora, count(*) AS contas\nFROM prt_contas\nWHERE tem_autorizacao = false\nGROUP BY operadora;', columns: ['operadora', 'contas'], rows: [['Plena Care', 214], ['Integra Planos', 131], ['Vitta Saúde', 88]] },
    { id: 'sau-sql-3', question: 'Qual o próximo horário de ressonância por unidade?', sql: "SELECT unidade, min(proximo_horario) AS proximo\nFROM our_disponibilidade_exames\nWHERE exame = 'Ressonância magnética'\nGROUP BY unidade;", columns: ['unidade', 'proximo'], rows: [['Sanare Paulista', '2026-10-23 07:40'], ['Sanare Moema', '2026-10-22 18:20'], ['Sanare Campinas', '2026-10-24 09:00']] },
  ];

  const collections = [
    { id: 'sau-col-protocolos', name: 'Protocolos institucionais', theme: 'Protocolos', owner: u('champion'), domainId: D.atendimento, profiles: ['champion', 'engenheiro_ai', 'dono_negocio'], chunking: 'Por protocolo, até 350 tokens', embeddingModel: 'multilingual-e5-large' },
    { id: 'sau-col-autorizacao', name: 'Políticas de autorização', theme: 'Políticas', owner: u('dono_negocio'), domainId: D.autorizacao, profiles: ['dono_negocio', 'champion', 'engenheiro_ai'], chunking: 'Por seção, até 400 tokens', embeddingModel: 'multilingual-e5-large' },
    { id: 'sau-col-faturamento', name: 'Faturamento e TISS', theme: 'Manuais', owner: u('dono_negocio'), domainId: D.conta, profiles: ['dono_negocio', 'champion', 'engenheiro_dados'], chunking: 'Por seção, até 400 tokens', embeddingModel: 'multilingual-e5-large' },
    { id: 'sau-col-regulacao', name: 'Regulação e contratos com operadoras', theme: 'Regulamentação', owner: u('seguranca'), profiles: ['dono_negocio', 'champion', 'coe', 'seguranca'], chunking: 'Por cláusula', embeddingModel: 'multilingual-e5-large' },
  ] as IndustryContent['collections'];

  const documents: IndustryContent['documents'] = [
    { id: 'sau-doc-autorizacao', collectionId: 'sau-col-autorizacao', title: 'Política de autorização de exames 2026', version: '2026.1', updatedAt: dateAgo(21), status: 'processado', chunks: [
      'Exames laboratoriais simples e ultrassonografias não exigem pré-autorização nas operadoras conveniadas, desde que a carência tenha sido cumprida.',
      'Ressonância magnética e tomografia exigem pré-autorização da operadora. A Rede Sanare envia o pedido no mesmo dia e a resposta costuma chegar em até 3 dias úteis.',
      'PET-CT e exames de alta complexidade exigem laudo do médico solicitante anexado ao pedido; o prazo de resposta pode chegar a 10 dias úteis.',
      'Enquanto a autorização estiver em análise, o horário pode ser reservado por até 72 horas e é liberado automaticamente se a operadora negar.',
    ] },
    { id: 'sau-doc-preparo', collectionId: 'sau-col-protocolos', title: 'Protocolos de preparo de exames de imagem', version: '3.2', updatedAt: dateAgo(45), status: 'processado', chunks: [
      'Ressonância magnética de joelho: não exige jejum. Retire objetos metálicos e informe se possui marca-passo ou implante.',
      'Tomografia com contraste: jejum de 4 horas e exame de creatinina recente, quando o paciente tiver mais de 60 anos.',
      'Ultrassonografia de abdome total: jejum de 8 horas e bexiga cheia; beba quatro copos de água uma hora antes.',
      'Chegue 30 minutos antes do horário com documento com foto, carteirinha e pedido médico.',
    ] },
    { id: 'sau-doc-tiss', collectionId: 'sau-col-faturamento', title: 'Manual TISS interno do faturamento', version: '4.0', updatedAt: dateAgo(30), status: 'processado', chunks: [
      'Toda conta enviada à operadora deve trazer o número da guia autorizada para cada procedimento que exigiu autorização.',
      'Materiais especiais só podem ser cobrados com a nota fiscal e o código do material na tabela acordada com a operadora.',
      'Diárias são cobradas por período de 24 horas a partir da admissão; frações acima de 6 horas contam como diária adicional.',
      'O lote é fechado diariamente às 18h e enviado após a checagem automática de risco de glosa.',
    ] },
    { id: 'sau-doc-glosas', collectionId: 'sau-col-faturamento', title: 'Guia de prevenção de glosas por operadora', version: '2.1', updatedAt: dateAgo(14), status: 'processado', chunks: [
      'Plena Care: glosa materiais especiais sem autorização prévia, mesmo em internação de urgência. Solicite a autorização em até 24 horas da utilização.',
      'Integra Planos: exige o CRM do médico executante em todos os honorários; contas sem esse campo voltam integralmente.',
      'Vitta Saúde: aceita reapresentação de glosa em até 60 dias com justificativa técnica assinada.',
      'Itens acima de R$ 5 mil passam por revisão do auditor de contas antes do envio do lote.',
    ] },
    { id: 'sau-doc-prazos', collectionId: 'sau-col-regulacao', title: 'Resumo interno de prazos de atendimento e cobertura', version: '1.4', updatedAt: dateAgo(80), status: 'processado', chunks: [
      'Este resumo orienta as equipes da Rede Sanare e não substitui as normas oficiais do setor de saúde suplementar.',
      'Exames básicos devem ser oferecidos em prazo curto; exames de alta complexidade têm prazo maior e dependem da autorização da operadora.',
      'Negativas de cobertura devem ser informadas ao paciente por escrito, com o motivo apresentado pela operadora.',
    ] },
    { id: 'sau-doc-contrato-vitta', collectionId: 'sau-col-regulacao', title: 'Contrato com a operadora Vitta Saúde · cláusulas operacionais', version: '2025.2', updatedAt: dateAgo(120), status: 'processado', chunks: [
      'A operadora responde aos pedidos de autorização de exames de imagem em até 3 dias úteis pelo portal TISS.',
      'Contas devem ser enviadas em até 30 dias após a alta ou a realização do exame.',
      'Divergências de valor seguem a tabela anexa vigente na data do atendimento.',
    ] },
  ];

  const retrievals = [
    { question: DEMO.showcaseQuestion, answer: 'Sim. Ressonância magnética exige pré-autorização da operadora; a Rede Sanare envia o pedido no mesmo dia e a resposta costuma chegar em até 3 dias úteis. O horário pode ficar reservado por até 72 horas enquanto a autorização está em análise.', results: [{ docId: 'sau-doc-autorizacao', chunkIndex: 1, score: 0.94 }, { docId: 'sau-doc-autorizacao', chunkIndex: 3, score: 0.82 }, { docId: 'sau-doc-contrato-vitta', chunkIndex: 0, score: 0.71 }] },
    { question: 'qual o preparo para ressonância de joelho?', answer: 'Não exige jejum. Retire objetos metálicos, informe se tem marca-passo ou implante e chegue 30 minutos antes com documento, carteirinha e pedido médico.', results: [{ docId: 'sau-doc-preparo', chunkIndex: 0, score: 0.95 }, { docId: 'sau-doc-preparo', chunkIndex: 3, score: 0.77 }] },
    { question: 'a Plena Care glosa material especial sem autorização?', answer: 'Sim, mesmo em internação de urgência. A orientação é solicitar a autorização em até 24 horas da utilização do material.', results: [{ docId: 'sau-doc-glosas', chunkIndex: 0, score: 0.92 }, { docId: 'sau-doc-tiss', chunkIndex: 1, score: 0.76 }] },
  ];

  const knowledgeGraph: IndustryContent['knowledgeGraph'] = {
    nodes: [
      { id: 'sau-kg-paciente', label: 'Paciente', kind: 'entidade' },
      { id: 'sau-kg-exame', label: 'Exame', kind: 'entidade' },
      { id: 'sau-kg-autorizacao', label: 'Autorização', kind: 'entidade' },
      { id: 'sau-kg-conta', label: 'Conta', kind: 'entidade' },
      { id: 'sau-kg-operadora', label: 'Operadora', kind: 'entidade' },
      { id: 'sau-tb-our-paciente', label: 'our_paciente_360', kind: 'tabela' },
      { id: 'sau-tb-our-glosa', label: 'our_glosa_por_operadora', kind: 'tabela' },
      { id: 'sau-tb-our-agenda', label: 'our_disponibilidade_exames', kind: 'tabela' },
      { id: 'sau-doc-autorizacao', label: 'Política de autorização 2026', kind: 'documento' },
      { id: 'sau-doc-preparo', label: 'Protocolos de preparo', kind: 'documento' },
      { id: 'sau-doc-glosas', label: 'Guia de prevenção de glosas', kind: 'documento' },
      { id: 'sau-dt-cobertura', label: 'Cobertura e pré-autorização', kind: 'regra' },
      { id: 'sau-dt-glosa', label: 'Risco de glosa', kind: 'regra' },
    ],
    edges: [
      { source: 'sau-kg-paciente', target: 'sau-kg-exame', label: 'realiza' },
      { source: 'sau-kg-exame', target: 'sau-kg-autorizacao', label: 'pode exigir' },
      { source: 'sau-kg-autorizacao', target: 'sau-dt-cobertura', label: 'decidida por' },
      { source: 'sau-dt-cobertura', target: 'sau-doc-autorizacao', label: 'origem' },
      { source: 'sau-kg-exame', target: 'sau-doc-preparo', label: 'preparo' },
      { source: 'sau-kg-exame', target: 'sau-tb-our-agenda', label: 'disponibilidade' },
      { source: 'sau-kg-paciente', target: 'sau-tb-our-paciente', label: 'publicada em' },
      { source: 'sau-kg-paciente', target: 'sau-kg-operadora', label: 'tem plano' },
      { source: 'sau-kg-conta', target: 'sau-kg-operadora', label: 'cobrada de' },
      { source: 'sau-kg-conta', target: 'sau-dt-glosa', label: 'avaliada por' },
      { source: 'sau-dt-glosa', target: 'sau-doc-glosas', label: 'origem' },
      { source: 'sau-kg-conta', target: 'sau-tb-our-glosa', label: 'publicada em' },
    ],
  };

  const artifacts: IndustryContent['artifacts'] = [
    { id: 'sau-art-okr-glosa', areaId: 'area-empresa', kind: 'OKR', title: 'Reduzir a taxa de glosa para 4%', summary: 'Meta de 2026 do faturamento, medida por operadora.', tags: ['okr', 'glosa'], metrics: [{ label: 'Atual', value: '5,1%' }, { label: 'Meta', value: '4%' }] },
    { id: 'sau-art-okr-autoriz', areaId: 'area-empresa', kind: 'OKR', title: 'Autorizar exames em menos de 12 horas', summary: 'Tempo entre o pedido médico e a resposta da operadora.', tags: ['okr', 'autorização'], metrics: [{ label: 'Atual', value: '19 h' }, { label: 'Meta', value: '12 h' }] },
    { id: 'sau-art-proc-fat', areaId: 'area-empresa', kind: 'Processo', title: 'Ciclo de faturamento hospitalar', summary: 'Alta → fechamento da conta → auditoria → lote TISS → demonstrativo → recurso de glosa.', tags: ['processo', 'faturamento'] },
    { id: 'sau-art-mkt-bench', areaId: 'area-mercado', kind: 'Ficha de mercado', title: 'Benchmark de glosa em hospitais privados', summary: 'Hospitais de porte semelhante têm glosa entre 3% e 7%; os melhores fazem auditoria antes do envio.', body: 'Fonte: levantamento setorial fictício para a demo, agosto de 2026.', tags: ['benchmark', 'glosa'], metrics: [{ label: 'Fonte', value: 'Levantamento setorial' }, { label: 'Data', value: 'ago/2026' }] },
    { id: 'sau-art-mkt-reg', areaId: 'area-mercado', kind: 'Ficha de regulação', title: 'Prazos de atendimento e cobertura', summary: 'Prazos máximos para exames básicos e de alta complexidade orientam a regra de cobertura.', body: 'Fonte: Resumo interno de prazos de atendimento e cobertura, revisão 1.4. Origina a regra "Cobertura e pré-autorização de exame".', tags: ['regulação', 'cobertura'], metrics: [{ label: 'Fonte', value: 'Resumo interno 1.4' }, { label: 'Data', value: 'ago/2026' }] },
    { id: 'sau-art-mkt-digital', areaId: 'area-mercado', kind: 'Ficha de mercado', title: 'Agendamento digital em redes hospitalares', summary: '62% dos agendamentos de exame em redes concorrentes já começam em canais digitais.', tags: ['digital', 'agendamento'], metrics: [{ label: 'Fonte', value: 'Pesquisa com pacientes' }, { label: 'Data', value: 'jul/2026' }] },
    { id: 'sau-art-jor-exame', areaId: 'area-jornadas', kind: 'Mapa de jornada', title: 'Agendamento de exame', summary: 'Etapas: pedido médico → autorização → agendamento → preparo → realização → resultado. Dor: espera pela autorização sem retorno.', tags: ['jornada', 'exame'], metrics: [{ label: 'KPI', value: 'Tempo de autorização' }, { label: 'Canais', value: 'WhatsApp, App, Telefone' }] },
    { id: 'sau-art-jor-consulta', areaId: 'area-jornadas', kind: 'Mapa de jornada', title: 'Consulta ambulatorial', summary: 'Etapas: marcação → lembrete → confirmação → consulta. Dor: faltas sem aviso.', tags: ['jornada', 'no-show'], metrics: [{ label: 'KPI', value: 'No-show' }] },
    { id: 'sau-art-jor-fat', areaId: 'area-jornadas', kind: 'Mapa de jornada', title: 'Jornada do auditor de contas', summary: 'Colaborador interno: fila de contas → checagem → correção → envio. Dor: retrabalho com glosas repetidas.', tags: ['jornada', 'colaborador'] },
    { id: 'sau-art-prd-checkup', areaId: 'area-produtos', kind: 'Produto', title: 'Check-up executivo Sanare', summary: 'Pacote de exames em meio período, para empresas e particulares.', tags: ['check-up', 'empresas'], metrics: [{ label: 'Preço particular', value: 'R$ 1.890' }] },
    { id: 'sau-art-prd-imagem', areaId: 'area-produtos', kind: 'Produto', title: 'Centro de diagnóstico por imagem', summary: 'Ressonância, tomografia e ultrassom em três unidades, com resultado digital em 48 horas.', tags: ['imagem'] },
    { id: 'sau-art-prd-telecons', areaId: 'area-produtos', kind: 'Produto', title: 'Teleconsulta de retorno', summary: 'Retorno médico por vídeo para pacientes com exames já realizados na rede.', tags: ['telemedicina'] },
    { id: 'sau-art-reg-cobertura', areaId: 'area-regras', kind: 'Tabela de decisão', title: 'Cobertura e pré-autorização de exame', summary: 'Cobertura, exigência de pré-autorização e prazo por tipo de exame, segmentação e carência.', tags: ['regra', 'autorização'], componentId: 'sau-cp-rule-cobertura' },
    { id: 'sau-art-reg-glosa', areaId: 'area-regras', kind: 'Tabela de decisão', title: 'Risco de glosa por operadora', summary: 'Classifica itens da conta em risco alto, médio ou baixo antes do envio.', tags: ['regra', 'glosa'] },
    { id: 'sau-art-reg-diag', areaId: 'area-regras', kind: 'Guardrail', title: 'Nunca informar diagnóstico ao paciente', summary: 'Agentes não interpretam exames nem sugerem diagnóstico; orientam a falar com o médico.', tags: ['guardrail', 'saúde'], componentId: 'sau-cp-rule-diagnostico' },
    { id: 'sau-art-fhir', areaId: 'area-arquitetura', kind: 'Integração padrão', title: 'HL7 FHIR R4 como padrão de integração clínica', summary: 'Patient, Encounter, Appointment e ServiceRequest via FHIR; nada de acesso direto ao banco do PEP.', tags: ['fhir', 'integração'] },
  ];

  const decisionTables: DecisionTable[] = [
    {
      id: 'sau-dt-cobertura', name: 'Cobertura e pré-autorização de exame', domainId: D.autorizacao, version: '1.4.0', componentId: 'sau-cp-rule-cobertura',
      description: 'Indica se o exame é coberto, se exige pré-autorização da operadora e o prazo esperado.',
      source: 'Política de autorização de exames 2026 e Resumo interno de prazos de atendimento',
      inputs: [
        { key: 'tipo_exame', label: 'Tipo de exame', type: 'enum', options: ['laboratorial_simples', 'imagem_simples', 'ressonancia', 'tomografia', 'pet_ct'] },
        { key: 'segmentacao', label: 'Segmentação do plano', type: 'enum', options: ['ambulatorial', 'hospitalar', 'referencia'] },
        { key: 'carencia_cumprida', label: 'Carência cumprida', type: 'boolean' },
      ],
      outputs: [{ key: 'cobertura', label: 'Cobertura' }, { key: 'pre_autorizacao', label: 'Pré-autorização' }, { key: 'prazo', label: 'Prazo de resposta' }],
      rows: [
        { id: 'r1', conditions: { tipo_exame: '*', segmentacao: '*', carencia_cumprida: '=false' }, outputs: { cobertura: 'Não coberto (carência)', pre_autorizacao: 'Não se aplica', prazo: '—' } },
        { id: 'r2', conditions: { tipo_exame: 'laboratorial_simples|imagem_simples', segmentacao: '*', carencia_cumprida: '=true' }, outputs: { cobertura: 'Coberto', pre_autorizacao: 'Não exige', prazo: 'Imediato' } },
        { id: 'r3', conditions: { tipo_exame: 'ressonancia|tomografia', segmentacao: 'ambulatorial|referencia', carencia_cumprida: '=true' }, outputs: { cobertura: 'Coberto', pre_autorizacao: 'Exige', prazo: '3 dias úteis' } },
        { id: 'r4', conditions: { tipo_exame: 'ressonancia|tomografia', segmentacao: '=hospitalar', carencia_cumprida: '=true' }, outputs: { cobertura: 'Coberto só em internação', pre_autorizacao: 'Exige', prazo: '3 dias úteis' }, note: 'Plano só hospitalar não cobre exame ambulatorial.' },
        { id: 'r5', conditions: { tipo_exame: '=pet_ct', segmentacao: '*', carencia_cumprida: '=true' }, outputs: { cobertura: 'Coberto conforme diretriz', pre_autorizacao: 'Exige com laudo', prazo: '10 dias úteis' } },
      ],
      sampleCase: { tipo_exame: 'ressonancia', segmentacao: 'referencia', carencia_cumprida: true },
    },
    {
      id: 'sau-dt-glosa', name: 'Risco de glosa por operadora', domainId: D.conta, version: '2.0.0',
      description: 'Classifica cada item da conta em risco de glosa e indica a ação antes do envio do lote.',
      source: 'Guia de prevenção de glosas por operadora',
      inputs: [
        { key: 'operadora', label: 'Operadora', type: 'enum', options: ['Vitta Saúde', 'Plena Care', 'Integra Planos'] },
        { key: 'item_tipo', label: 'Tipo de item', type: 'enum', options: ['material_especial', 'medicamento', 'diaria', 'honorario'] },
        { key: 'tem_autorizacao', label: 'Tem autorização', type: 'boolean' },
        { key: 'valor', label: 'Valor do item (R$)', type: 'number' },
      ],
      outputs: [{ key: 'risco', label: 'Risco' }, { key: 'acao', label: 'Ação' }],
      rows: [
        { id: 'r1', conditions: { operadora: '=Plena Care', item_tipo: '=material_especial', tem_autorizacao: '=false', valor: '*' }, outputs: { risco: 'Alto', acao: 'Solicitar autorização antes do envio' } },
        { id: 'r2', conditions: { operadora: '*', item_tipo: '*', tem_autorizacao: '=true', valor: '>5000' }, outputs: { risco: 'Médio', acao: 'Revisão do auditor de contas' } },
        { id: 'r3', conditions: { operadora: '=Integra Planos', item_tipo: '=honorario', tem_autorizacao: '*', valor: '<=5000' }, outputs: { risco: 'Médio', acao: 'Conferir CRM do executante' } },
        { id: 'r4', conditions: { operadora: 'Vitta Saúde|Plena Care', item_tipo: 'medicamento|diaria|honorario', tem_autorizacao: '=true', valor: '<=5000' }, outputs: { risco: 'Baixo', acao: 'Enviar no lote' } },
      ],
      sampleCase: { operadora: 'Plena Care', item_tipo: 'material_especial', tem_autorizacao: false, valor: 7480 },
    },
    {
      id: 'sau-dt-lembrete', name: 'Canal de lembrete de consulta', domainId: D.agenda, version: '1.1.0',
      description: 'Escolhe o canal do lembrete conforme consentimento e perfil do paciente.',
      source: 'Política de comunicação com pacientes',
      inputs: [{ key: 'consentimento_whatsapp', label: 'Consentiu WhatsApp', type: 'boolean' }, { key: 'usa_app', label: 'Usa o app', type: 'boolean' }],
      outputs: [{ key: 'canal', label: 'Canal' }],
      rows: [
        { id: 'r1', conditions: { consentimento_whatsapp: '=true', usa_app: '*' }, outputs: { canal: 'WhatsApp' } },
        { id: 'r2', conditions: { consentimento_whatsapp: '=false', usa_app: '=true' }, outputs: { canal: 'Push no app' } },
        { id: 'r3', conditions: { consentimento_whatsapp: '=false', usa_app: '=false' }, outputs: { canal: 'SMS' } },
      ],
      sampleCase: { consentimento_whatsapp: false, usa_app: true },
    },
  ];

  const components: IndustryContent['components'] = [
    { id: 'sau-cp-agent-agendamento', type: 'agent', name: 'Agente de agendamento de exames', version: '1.3.0', status: 'publicado_prd', domainId: D.agenda, owner: 'champion',
      description: 'Agenda exames considerando cobertura, autorização e preparo, sempre sem interpretar o pedido médico.',
      content: 'Papel: atendente de agendamento da Rede Sanare.\nRegras: Nunca informar diagnóstico ao paciente; Regra de cobertura e pré-autorização.\nSkills: Explicar preparo de exame.\nTools: consultar_horarios, reservar_horario, solicitar_autorizacao.',
      inputs: ['pedido do paciente', 'cobertura', 'horários livres'], outputs: ['proposta de horário', 'orientações'],
      dependencies: ['sau-cp-rule-diagnostico', 'sau-cp-rule-cobertura', 'sau-cp-skill-preparo'],
      log: [['1.0.0', 140, 'Versão inicial.'], ['1.3.0', 25, 'Reserva horário durante a autorização.']] },
    { id: 'sau-cp-rule-diagnostico', type: 'rule', name: 'Nunca informar diagnóstico ao paciente', version: '2.0.0', status: 'publicado_prd', owner: 'seguranca',
      description: 'Guardrail de destaque: IA não emite diagnóstico nem interpreta exames; dado de saúde é sensível.',
      content: 'SE resposta.menciona_diagnostico OU resposta.interpreta_resultado\nENTAO bloquear_resposta E orientar("Esse ponto deve ser conversado com o seu médico.")',
      inputs: ['resposta do agente'], outputs: ['resposta liberada ou bloqueio'],
      log: [['1.0.0', 260, 'Versão inicial.'], ['2.0.0', 50, 'Bloqueia também interpretação de resultados.']] },
    { id: 'sau-cp-rule-cobertura', type: 'rule', name: 'Regra de cobertura e pré-autorização', version: '1.4.0', status: 'publicado_prd', domainId: D.autorizacao, owner: 'dono_negocio',
      description: 'Tabela de decisão publicada como componente Rule.',
      content: 'Fonte: tabela "Cobertura e pré-autorização de exame" v1.4.0 (5 linhas).\nSaídas: cobertura, pre_autorizacao, prazo.',
      inputs: ['tipo_exame', 'segmentacao', 'carencia_cumprida'], outputs: ['cobertura', 'pre_autorizacao', 'prazo'] },
    { id: 'sau-cp-skill-preparo', type: 'skill', name: 'Explicar preparo de exame', version: '1.1.0', status: 'homologado', domainId: D.agenda, owner: 'engenheiro_ai',
      description: 'Explica o preparo do exame em linguagem simples, citando o protocolo institucional.',
      content: 'Instruções: busque o protocolo do exame; resuma em até 4 itens; inclua o horário de chegada; não comente o motivo do exame.',
      inputs: ['exame'], outputs: ['orientações de preparo'] },
    { id: 'sau-cp-agent-glosa', type: 'agent', name: 'Agente auditor de contas', version: '2.2.0', status: 'publicado_prd', domainId: D.conta, owner: 'champion',
      description: 'Revisa a conta antes do envio, aponta itens com risco de glosa e sugere a correção.',
      content: 'Papel: auditor de contas assistido.\nRegras: Risco de glosa por operadora.\nSkills: Validar guia TISS.\nNunca altera valores: só sugere ao auditor humano.',
      inputs: ['conta', 'itens', 'regras da operadora'], outputs: ['itens com risco', 'sugestões'], dependencies: ['sau-cp-skill-tiss'] },
    { id: 'sau-cp-skill-tiss', type: 'skill', name: 'Validar guia TISS', version: '1.0.3', status: 'publicado_prd', domainId: D.conta, owner: 'engenheiro_ai',
      description: 'Confere campos obrigatórios da guia e a existência de autorização por procedimento.',
      content: 'Instruções: para cada procedimento, verifique número da guia, CRM do executante e código do item na tabela da operadora.', inputs: ['guia'], outputs: ['pendências'] },
    { id: 'sau-cp-doc-tiss', type: 'documento', name: 'Manual TISS interno', version: '4.0.0', status: 'homologado', owner: 'dono_negocio',
      description: 'Documento de referência do faturamento, versionado.', content: 'Documento: sau-doc-tiss (4 trechos).', inputs: [], outputs: ['trechos citáveis'] },
    { id: 'sau-cp-pacote-digital', type: 'pacote', name: 'Pacote Atendimento Digital 2.1', version: '2.1.0', status: 'homologado', domainId: D.agenda, owner: 'champion', packageKind: 'jornada',
      description: 'Composição homologada para jornadas curtas de atendimento ao paciente.',
      content: 'Componentes fixados:\n- Agente de agendamento de exames 1.3.0\n- Nunca informar diagnóstico ao paciente 2.0.0\n- Explicar preparo de exame 1.1.0\n- Mascarar PII antes de enviar ao canal 1.3.0',
      inputs: [], outputs: ['plugin cortex-atendimento-digital@2.1.0'], dependencies: ['sau-cp-agent-agendamento', 'sau-cp-rule-diagnostico', 'sau-cp-skill-preparo', 'sau-cp-hook-pii'] },
    { id: 'sau-cp-pacote-fat', type: 'pacote', name: 'Esteira de faturamento sem glosa', version: '0.8.0', status: 'rascunho', domainId: D.conta, owner: 'champion', packageKind: 'esteira',
      description: 'Esteira durável de auditoria e envio de lotes.', content: 'Componentes fixados:\n- Agente auditor de contas 2.2.0\n- Validar guia TISS 1.0.3',
      inputs: [], outputs: ['plugin cortex-faturamento@0.8.0'], dependencies: ['sau-cp-agent-glosa', 'sau-cp-skill-tiss'] },
  ];

  const journeys: IndustryContent['journeys'] = [
    {
      id: J.anchor, name: 'Agendamento de exame com pré-autorização pelo WhatsApp', anchor: true, type: 'agentica', domainId: D.agenda, initiativeId: 'sau-in-01',
      description: 'O paciente envia o pedido médico pelo WhatsApp; a jornada verifica cobertura, pede a autorização e agenda com as orientações de preparo.',
      triggerLabel: 'Mensagem do paciente', risk: 'supervisionada',
      brainInputs: ['Regras de cobertura', 'Agenda', 'Contrato Paciente', 'Protocolo de preparo'],
      persona: { name: 'Ana Lacerda · paciente Vitta Saúde', message: 'Bom dia! Meu médico pediu uma ressonância do joelho. Consigo agendar pelo plano Vitta?' },
      kpis: ['Tempo de autorização', 'Agendamentos sem atendente', 'No-show'],
      testCases: [
        ['Ressonância com autorização', 'Preciso agendar uma ressonância de joelho pelo Vitta', 'Solicita autorização, reserva horário e envia preparo', 'passou'],
        ['Exame laboratorial simples', 'Quero marcar um hemograma', 'Agenda direto, sem pré-autorização', 'passou'],
        ['Pergunta sobre diagnóstico', 'O que significa esse resultado da minha ressonância?', 'Não interpreta e orienta procurar o médico', 'passou'],
      ],
      nodes: [
        { id: 'msg', kind: 'gatilho.mensagem', label: 'Mensagem WhatsApp', at: [0, 1], channelId: 'sau-ch-whatsapp', to: 'extrair',
          s: { in: 'Bom dia! Meu médico pediu uma ressonância do joelho. Consigo agendar pelo plano Vitta? [foto do pedido médico]', out: 'Mensagem de +55 11 9****-3307 com imagem do pedido; paciente PAC-640118 identificada.', ms: 50 } },
        { id: 'extrair', kind: 'agente.extrair', label: 'Extrair dados do pedido', at: [1, 1], to: 'cobertura',
          s: { in: 'Imagem do pedido médico + texto', out: 'Exame: ressonância magnética de joelho direito; solicitante CRM-SP 1*****; operadora Vitta Saúde, plano referência; carência cumprida.', tok: 1650, ms: 1480 } },
        { id: 'cobertura', kind: 'logica.tabela', label: 'Regra de cobertura', at: [2, 1], ruleId: 'sau-dt-cobertura', componentId: 'sau-cp-rule-cobertura', to: 'cond',
          s: { in: 'tipo_exame=ressonancia, segmentacao=referencia, carencia_cumprida=sim', out: 'Linha 3: coberto; exige pré-autorização; prazo de 3 dias úteis.', rule: 'Cobertura e pré-autorização de exame v1.4.0 · linha 3', src: 'Política de autorização de exames 2026', ms: 30 } },
        { id: 'cond', kind: 'logica.condicao', label: 'Exige pré-autorização?', at: [3, 1], to: { sim: 'autorizar', 'não': 'agente' },
          s: { in: 'pre_autorizacao = Exige', out: 'sim', ms: 15, take: 'sim' } },
        { id: 'autorizar', kind: 'dados.tool', label: 'Solicitar autorização (TISS)', at: [4, 0], toolId: 'sau-tl-solicitar-autorizacao', to: 'agente',
          s: { in: 'Guia SP/SADT: ressonância de joelho, carteirinha CART-******91', out: 'Pedido G-7731204 enviado à Vitta Saúde; status em análise; resposta prevista até 24/10.', ms: 920 } },
        { id: 'agente', kind: 'agente.agente', label: 'Agente de agendamento', at: [5, 1], componentId: 'sau-cp-agent-agendamento', to: 'conteudo',
          s: { in: 'Cobertura ok, autorização em análise, horários livres', out: 'Proposta: reservar quinta, 23/10, 18h20, na Sanare Moema, por até 72 horas enquanto a autorização é analisada.', rule: 'Agente de agendamento de exames 1.3.0', tok: 1320, ms: 1690 } },
        { id: 'conteudo', kind: 'guardrail.conteudo', label: 'Nunca informar diagnóstico', at: [5, 3], componentId: 'sau-cp-rule-diagnostico', to: 'preparo',
          s: { in: 'Resposta proposta pelo agente', out: 'Nenhuma menção a diagnóstico ou interpretação clínica. Liberada.', rule: 'Nunca informar diagnóstico ao paciente 2.0.0', ms: 40 } },
        { id: 'preparo', kind: 'conhecimento.buscar', label: 'Buscar protocolo de preparo', at: [4, 3], componentId: 'sau-cp-skill-preparo', to: 'agenda',
          s: { in: 'ressonância magnética de joelho', out: 'Sem jejum; retirar objetos metálicos; informar marca-passo ou implante; chegar 30 minutos antes.', src: 'Protocolos de preparo de exames de imagem 3.2 · trecho 1', ms: 260 } },
        { id: 'agenda', kind: 'dados.tool', label: 'Reservar horário', at: [3, 3], toolId: 'sau-tl-reservar-horario', contractId: 'sau-ct-agenda', emitsPii: true, to: 'responder',
          s: { in: 'horario_id=H-559102, paciente_id=PAC-640118', out: 'Reserva AG-882310 para Ana Lacerda, CPF 527.104.386-07, nascida em 14/03/1988, telefone (11) 98140-3307: quinta 23/10, 18h20, Sanare Moema.', src: 'Contrato Agenda v2.0.0', ms: 410 } },
        { id: 'responder', kind: 'saida.responder', label: 'Responder no canal', at: [2, 3], channelId: 'sau-ch-whatsapp',
          s: { in: 'Reserva + preparo + status da autorização', out: 'Ana, reservei sua ressonância para quinta, 23/10, às 18h20, na Sanare Moema. Já pedimos a autorização à Vitta e avisamos por aqui assim que sair. Preparo: sem jejum, sem objetos metálicos e chegue 30 minutos antes.', ms: 240 } },
      ],
      versions: [
        { version: '0.1.0', daysAgo: 7, author: 'champion', note: 'Rascunho gerado por /cortex:desenhar a partir da iniciativa.', drop: ['cond', 'autorizar', 'conteudo'] },
        { version: '0.2.0', daysAgo: 1, author: 'engenheiro_ai', note: 'Inclui pré-autorização via TISS e o guardrail de diagnóstico.' },
      ],
      envVersions: { dev: '0.2.0', hml: null, prd: null },
      piiFilter: { in: 'Saída de "Reservar horário" com nome completo, CPF, data de nascimento e telefone', out: 'Reserva AG-882310 para Ana, CPF ***.104.386-**, telefone (11) 9****-3307: quinta 23/10, 18h20, Sanare Moema. Data de nascimento removida.' },
    },
    {
      id: J.prd, name: 'Prevenção de glosa antes do envio da conta', type: 'agentica', domainId: D.conta, initiativeId: 'sau-in-05',
      description: 'Quando a conta é fechada, o agente auditor confere itens contra as regras da operadora e só libera o lote sem risco alto.',
      triggerLabel: 'Conta fechada no faturamento', risk: 'supervisionada',
      brainInputs: ['Manual TISS', 'Histórico de glosas', 'Regras por operadora'],
      persona: { name: 'Evento do faturamento', message: 'Conta CT-778120 fechada: internação de 3 dias, operadora Plena Care, 42 itens.' },
      kpis: ['Taxa de glosa', 'Contas revisadas antes do envio', 'Valor recuperado'],
      testCases: [
        ['Material especial sem autorização', 'Conta Plena Care com stent sem guia', 'Marca risco alto e pede autorização', 'passou'],
        ['Conta limpa', 'Conta Vitta Saúde com diárias e honorários autorizados', 'Envia no lote sem revisão', 'passou'],
      ],
      nodes: [
        { id: 'evento', kind: 'gatilho.evento', label: 'Conta fechada', at: [0, 1], to: 'paciente',
          s: { in: '{"conta_id":"CT-778120","operadora":"Plena Care","itens":42}', out: 'Evento de fechamento recebido do faturamento.', ms: 25 } },
        { id: 'paciente', kind: 'dados.produto', label: 'Ler dados do paciente', at: [1, 1], contractId: 'sau-ct-paciente', emitsPii: true, to: 'conta',
          s: { in: 'paciente_id=PAC-311207', out: 'Carteirinha CART-******44, operadora Plena Care, plano hospitalar.', src: 'Contrato Paciente v2.0.0', ms: 160 } },
        { id: 'conta', kind: 'dados.produto', label: 'Ler itens da conta', at: [2, 1], contractId: 'sau-ct-conta', to: 'risco',
          s: { in: 'conta_id=CT-778120', out: '42 itens, total R$ 38.412,70; 1 material especial (stent) de R$ 7.480,00 sem guia.', src: 'Contrato Conta hospitalar v2.0.0', ms: 220 } },
        { id: 'risco', kind: 'logica.tabela', label: 'Risco de glosa', at: [3, 1], ruleId: 'sau-dt-glosa', to: 'agente',
          s: { in: 'operadora=Plena Care, item=material_especial, autorizacao=não, valor=R$ 7.480', out: 'Linha 1: risco alto; solicitar autorização antes do envio.', rule: 'Risco de glosa por operadora v2.0.0 · linha 1', ms: 35 } },
        { id: 'agente', kind: 'agente.agente', label: 'Agente auditor de contas', at: [4, 1], componentId: 'sau-cp-agent-glosa', to: 'cond',
          s: { in: '1 item de risco alto, 41 itens sem pendência', out: 'Sugestão: segurar o stent, pedir autorização retroativa (prazo de 24 h da Plena Care) e enviar os demais itens no lote de hoje.', src: 'Guia de prevenção de glosas por operadora 2.1', tok: 1540, ms: 1640 } },
        { id: 'cond', kind: 'logica.condicao', label: 'Há item com risco alto?', at: [5, 1], to: { sim: 'aprovacao', 'não': 'lote' },
          s: { in: 'itens_risco_alto = 1', out: 'sim', ms: 10, take: 'sim' } },
        { id: 'aprovacao', kind: 'pessoas.aprovacao', label: 'Revisão do auditor', at: [6, 0], to: { aprovado: 'lote', reprovado: 'pii' },
          s: { in: 'Sugestão do agente', out: 'Auditor aprovou a sugestão.', ms: 900, take: 'aprovado' } },
        { id: 'lote', kind: 'dados.tool', label: 'Enviar lote TISS', at: [7, 1], toolId: 'sau-tl-enviar-lote', to: 'pii',
          s: { in: '41 itens liberados', out: 'Lote LT-260411 enviado à Plena Care: R$ 30.932,70.', ms: 1240 } },
        { id: 'pii', kind: 'guardrail.pii', label: 'Filtro de PII', at: [8, 1], componentId: 'sau-cp-hook-pii', to: 'notificar',
          s: { in: 'Resumo com nome e carteirinha do paciente', out: 'Nome e carteirinha mascarados no resumo.', rule: 'Mascarar PII antes de enviar ao canal 1.3.0', ms: 30 } },
        { id: 'notificar', kind: 'saida.notificar', label: 'Notificar faturamento', at: [9, 1], channelId: 'sau-ch-backoffice',
          s: { in: 'Resumo da auditoria', out: 'Fila "Auditoria de contas": CT-778120 enviada parcialmente; stent aguardando autorização.', ms: 120 } },
      ],
      versions: [
        { version: '1.0.0', daysAgo: 95, author: 'champion', note: 'Primeira versão em produção.', drop: ['risco', 'pii'] },
        { version: '1.1.0', daysAgo: 38, author: 'engenheiro_ai', note: 'Risco calculado pela tabela do cérebro.', drop: ['pii'] },
        { version: '1.2.0', daysAgo: 5, author: 'engenheiro_ai', note: 'Mascara dados do paciente antes de notificar o backoffice.' },
      ],
      envVersions: { dev: '1.2.0', hml: '1.2.0', prd: '1.1.0' },
    },
    {
      id: J.auto, name: 'Lembrete e confirmação de consulta', type: 'automacao', domainId: D.agenda, initiativeId: 'sau-in-04',
      description: 'Automação sem agente: 48 horas antes, envia lembrete pelo canal preferido, confirma ou libera o horário.',
      triggerLabel: 'Agendamento a 48 h', risk: 'autonoma',
      brainInputs: ['Agenda', 'Preferência de canal'],
      persona: { name: 'Rotina agendada', message: 'Rotina das 8h: 312 consultas marcadas para 23/10.' },
      kpis: ['No-show', 'Horários reaproveitados'],
      testCases: [
        ['Paciente confirma', 'Resposta "SIM" ao lembrete', 'Agendamento confirmado', 'passou'],
        ['Paciente não responde', 'Sem resposta em 24 h', 'Horário liberado para a fila de espera', 'passou'],
      ],
      nodes: [
        { id: 'rotina', kind: 'gatilho.agendamento', label: 'Consultas em 48 h', at: [0, 0], to: 'ler',
          s: { in: 'cron 0 8 * * *', out: '312 consultas para 23/10.', ms: 20 } },
        { id: 'ler', kind: 'dados.produto', label: 'Ler agenda', at: [1, 0], contractId: 'sau-ct-agenda', to: 'canal',
          s: { in: 'data=2026-10-23', out: 'Consulta AG-880014 · Cardiologia · 09h00 · Sanare Paulista.', src: 'Contrato Agenda v2.0.0', ms: 140 } },
        { id: 'canal', kind: 'logica.tabela', label: 'Canal de lembrete', at: [2, 0], ruleId: 'sau-dt-lembrete', to: 'enviar',
          s: { in: 'consentimento_whatsapp=não, usa_app=sim', out: 'Linha 2: push no app.', rule: 'Canal de lembrete de consulta v1.1.0 · linha 2', ms: 15 } },
        { id: 'enviar', kind: 'saida.notificar', label: 'Enviar lembrete', at: [3, 0], channelId: 'sau-ch-app', to: 'esperar',
          s: { in: 'Lembrete AG-880014', out: 'Push enviado: "Sua consulta é quinta às 9h. Confirma?"', ms: 180 } },
        { id: 'esperar', kind: 'logica.esperar', label: 'Aguardar resposta (24 h)', at: [4, 0], to: 'cond',
          s: { in: 'Janela de 24 horas', out: 'Resposta recebida após 3 h 12 min (simulado).', ms: 20 } },
        { id: 'cond', kind: 'logica.condicao', label: 'Paciente confirmou?', at: [5, 0], to: { sim: 'confirmar', 'não': 'liberar' },
          s: { in: 'resposta = "SIM"', out: 'sim', ms: 10, take: 'sim' } },
        { id: 'confirmar', kind: 'dados.tool', label: 'Confirmar na agenda', at: [6, 0], toolId: 'sau-tl-confirmar', to: 'fim',
          s: { in: 'AG-880014', out: 'Agendamento confirmado.', ms: 190 } },
        { id: 'liberar', kind: 'dados.tool', label: 'Liberar horário', at: [6, 1], toolId: 'sau-tl-liberar-horario', to: 'fim',
          s: { in: 'AG-880014', out: 'Horário devolvido à fila de espera.', ms: 210 } },
        { id: 'fim', kind: 'saida.encerrar', label: 'Encerrar', at: [7, 0], s: { in: 'Fluxo concluído', out: 'Encerrado.', ms: 5 } },
      ],
      versions: [
        { version: '0.9.0', daysAgo: 18, author: 'engenheiro_ai', note: 'Lembrete sempre por SMS.', drop: ['canal'] },
        { version: '1.0.0', daysAgo: 6, author: 'engenheiro_ai', note: 'Canal escolhido pela tabela do cérebro.' },
      ],
      envVersions: { dev: '1.0.0', hml: '1.0.0', prd: null },
    },
  ];

  const initiatives: IndustryContent['initiatives'] = [
    {
      id: 'sau-in-01', title: 'Paciente agenda exame com pré-autorização pelo WhatsApp', type: 'nova_jornada', domainId: D.agenda, owner: u('dono_negocio'),
      stage: 'ideia', expectedValueBRL: 1900000, health: 'ok', journeyId: J.anchor,
      problem: '41% das ligações da central são de agendamento de exames que dependem de autorização, com retorno médio de 52 horas.',
      objective: 'Receber o pedido médico pelo WhatsApp, pedir a autorização e reservar o horário no mesmo contato.',
      metric: 'Tempo de autorização de 52 h para 12 h',
      validation: {
        checks: [
          { key: 'estrategia', label: 'Estratégia', result: 'verde', summary: 'Move o OKR "Autorizar exames em menos de 12 horas" e reduz o no-show.', source: 'Empresa · OKRs 2026' },
          { key: 'mercado', label: 'Mercado e regulação', result: 'verde', summary: 'Redes concorrentes já agendam por canais digitais; prazos de cobertura do setor estão refletidos na regra.', source: 'Mercado · Agendamento digital (jul/2026)' },
          { key: 'regras', label: 'Regras de negócio', result: 'verde', summary: 'Usa "Cobertura e pré-autorização de exame" v1.4.0 e o guardrail de diagnóstico.', source: 'Regras de negócio' },
          { key: 'dados', label: 'Dados', result: 'amarelo', summary: 'Contratos Paciente e Agenda publicados. Lacuna de dado: carência cumprida não vem estruturada das operadoras.', source: 'Dados · Contrato Paciente' },
          { key: 'integracoes', label: 'Integrações e canais', result: 'verde', summary: 'HIS/PEP, TISS e Agenda conectados; WhatsApp configurado sem jornada vinculada.', source: 'Conectores e Canais' },
          { key: 'arquitetura', label: 'Arquitetura', result: 'verde', summary: 'Padrão "Agente com recuperação e tools"; dado sensível em modelo com processamento no Brasil.', source: 'Arquitetura · referências' },
          { key: 'reuso', label: 'Reuso', result: 'verde', summary: '70% de reuso: Agente de agendamento, Regra de cobertura, Explicar preparo, Nunca informar diagnóstico e Mascarar PII.', source: 'Catálogo · Pacote Atendimento Digital 2.1' },
          { key: 'business_case', label: 'Business case', result: 'amarelo', summary: 'R$ 1,9 milhão por ano em ligações evitadas e faltas reduzidas; premissa de adesão de 45% ao WhatsApp a confirmar.', source: 'Telemetria · custo por contato da central' },
        ],
        recommendation: 'O cérebro indica seguir como jornada agêntica supervisionada, com o guardrail de diagnóstico obrigatório. Recomendamos avaliar com as operadoras como obter a carência de forma estruturada.',
        attention: ['Lacuna de dado: carência cumprida não estruturada', 'Dado de saúde é sensível: modelos só com processamento no Brasil', 'Dado pessoal chega ao WhatsApp: exigir filtro de PII'],
        reusePct: 70, solutionType: 'agente',
      },
    },
    { id: 'sau-in-02', title: 'Resultado de exame liberado com aviso no app', type: 'nova_jornada', domainId: D.atendimento, owner: u('dono_negocio'), stage: 'ideia', expectedValueBRL: 480000, health: 'ok',
      problem: 'Pacientes ligam para saber se o resultado saiu.', objective: 'Aviso automático, sem conteúdo clínico, quando o resultado for liberado.', metric: 'Ligações sobre resultado: -60%' },
    { id: 'sau-in-03', title: 'Triagem administrativa no pronto atendimento', type: 'agente_ia', domainId: D.atendimento, owner: u('champion'), stage: 'validacao', expectedValueBRL: 950000, health: 'atencao',
      problem: 'Fila de cadastro no PA chega a 40 minutos.', objective: 'Pré-cadastro pelo WhatsApp antes da chegada, sem triagem clínica.', metric: 'Tempo de cadastro de 40 para 10 minutos' },
    { id: 'sau-in-04', title: 'Lembrete e confirmação de consulta', type: 'eficiencia', domainId: D.agenda, owner: u('dono_negocio'), stage: 'construcao', expectedValueBRL: 1200000, health: 'ok', journeyId: J.auto,
      problem: 'No-show de 18% nas consultas ambulatoriais.', objective: 'Lembrar pelo canal preferido e liberar horários não confirmados.', metric: 'No-show de 18% para 10%',
      validation: okValidation('O cérebro indica seguir como automação sem agente.', [], 60, 'automacao') },
    { id: 'sau-in-05', title: 'Prevenção de glosa antes do envio da conta', type: 'agente_ia', domainId: D.conta, owner: u('dono_negocio'), stage: 'operacao', expectedValueBRL: 5600000, health: 'ok', journeyId: J.prd,
      problem: 'Glosa de 7,8% do faturamento, metade por falta de autorização.', objective: 'Auditar contas antes do envio com as regras de cada operadora.', metric: 'Taxa de glosa de 7,8% para 4%',
      validation: okValidation('O cérebro indica seguir com revisão humana para itens de risco alto.', ['Manter o guia de glosas atualizado a cada novo contrato'], 58, 'agente') },
    { id: 'sau-in-06', title: 'Portal do médico com pendências de autorização', type: 'modernizacao', domainId: D.autorizacao, owner: u('champion'), stage: 'prototipo', expectedValueBRL: 640000, health: 'ok',
      problem: 'Médicos não sabem quais pedidos aguardam a operadora.', objective: 'Lista de pendências e prazos no portal do médico.', metric: 'Pedidos reenviados por engano: -70%' },
    { id: 'sau-in-07', title: 'Recurso de glosa assistido', type: 'agente_ia', domainId: D.conta, owner: u('dono_negocio'), stage: 'validacao', expectedValueBRL: 2100000, health: 'risco',
      problem: 'Só 35% das glosas são recorridas no prazo.', objective: 'Rascunho do recurso com justificativa técnica e documentos.', metric: 'Glosas recorridas no prazo de 35% para 80%' },
    { id: 'sau-in-08', title: 'Painel de ocupação de equipamentos de imagem', type: 'modernizacao', domainId: D.agenda, owner: u('champion'), stage: 'construcao', expectedValueBRL: 380000, health: 'ok',
      problem: 'Ressonâncias ociosas em horários de baixa demanda.', objective: 'Painel de ocupação alimentado pelo lakehouse.', metric: 'Ocupação de 71% para 85%' },
    { id: 'sau-in-09', title: 'Assistente interno de protocolos para enfermagem', type: 'agente_ia', domainId: D.atendimento, owner: u('champion'), stage: 'prototipo', expectedValueBRL: 300000, health: 'atencao',
      problem: 'Consulta a protocolos em PDFs extensos durante o plantão.', objective: 'Assistente no Teams que cita o protocolo vigente.', metric: 'Tempo de consulta a protocolo de 6 para 1 minuto' },
  ];

  const policies: IndustryContent['policies'] = [
    { id: 'sau-pol-modelo-br', name: 'Dado sensível de saúde só trafega por modelos com processamento no Brasil', kind: 'stack', description: 'Jornadas que leem dado classificado como sensível de saúde só podem usar modelos e provedores com processamento em território nacional.', condition: 'quando um nó lê dado sensível de saúde e o modelo configurado processa fora do Brasil', effect: 'bloquear', envs: ['dev', 'hml', 'prd'], active: true,
      code: JSON.stringify({ policy: 'saude-modelo-brasil', when: { data: { classification: 'sensivel', domain: 'saude' }, model: { region: { not: 'br' } } }, then: 'bloquear' }, null, 2) },
    { id: 'sau-pol-diagnostico', name: 'IA não emite diagnóstico', kind: 'jornada', description: 'Toda jornada que conversa com paciente precisa do guardrail "Nunca informar diagnóstico ao paciente".', condition: 'quando uma jornada com canal de paciente não tiver o guardrail de diagnóstico', effect: 'bloquear', envs: ['hml', 'prd'], active: true,
      code: JSON.stringify({ policy: 'sem-diagnostico', when: { journey: { channel: ['whatsapp', 'app'] }, missing: { component: 'sau-cp-rule-diagnostico' } }, then: 'bloquear' }, null, 2) },
  ];

  return {
    workspace: { id: 'ws-saude', industry: 'saude', company: 'Rede Sanare', segment: 'Rede hospitalar', tagline: 'Cuidado integrado do agendamento à alta',
      description: 'Rede hospitalar fictícia com 3 hospitais, 12 unidades de diagnóstico e 286 mil pacientes ativos. Atende por WhatsApp, app do paciente, portal do médico e backoffice de faturamento.' },
    userDomains: { dono_negocio: [D.agenda, D.autorizacao, D.conta], champion: [D.paciente, D.atendimento, D.agenda, D.autorizacao, D.conta, D.prestador], engenheiro_ai: [D.agenda, D.conta], engenheiro_dados: Object.values(D), seguranca: [D.paciente, D.atendimento], patrocinador: [D.conta] },
    systems, connectors, channels, domains, contracts, tables, sqlExamples,
    lineage: [
      ['sau-con-fhir', 'sau-tb-brz-patient'], ['sau-con-tiss', 'sau-tb-brz-contas'],
      ['sau-tb-brz-patient', 'sau-tb-prt-pacientes'], ['sau-tb-brz-contas', 'sau-tb-prt-contas'],
      ['sau-tb-prt-pacientes', 'sau-tb-our-paciente'], ['sau-tb-prt-contas', 'sau-tb-our-glosa'],
      ['sau-tb-our-paciente', 'sau-ct-paciente'], ['sau-tb-our-glosa', 'sau-ct-conta'],
      ['sau-ct-paciente', J.prd], ['sau-ct-conta', J.prd], ['sau-ct-paciente', J.anchor],
      [J.prd, 'sau-ch-backoffice'], [J.anchor, 'sau-ch-whatsapp'],
    ],
    collections, documents, retrievals, knowledgeGraph,
    coverage: [72, 55, 68, 34, 80, 63, 70, 52, 41, 77],
    artifacts, decisionTables, components, journeys, initiatives, policies,
    kpis: [
      { name: 'Taxa de glosa', unit: '%', baseline: 7.8, current: 5.1, target: 4, better: 'down' },
      { name: 'Tempo de autorização', unit: 'h', baseline: 52, current: 19, target: 12, better: 'down' },
      { name: 'No-show', unit: '%', baseline: 18, current: 12.5, target: 10, better: 'down' },
      { name: 'NPS', unit: 'pontos', baseline: 38, current: 52, target: 60, better: 'up' },
    ],
    guardrail: { text: 'Dado sensível de saúde só trafega por modelos com processamento no Brasil: modelo fora da região bloqueado', nodeId: 'agente' },
    dailyVolume: 2400,
    suggestions: ({ journeys: js }) => {
      const prdJ = js.find((j) => j.id === J.prd)!;
      return [
        { id: 'sau-sg-1', kind: 'skill', title: 'Criar skill "Autorização de material especial Plena Care"', status: 'nova', journeyId: J.prd, sourceDocId: 'sau-doc-glosas',
          evidence: `32% dos transbordos da jornada ${prdJ.name} ocorrem na mesma pergunta ("este material especial exige autorização da Plena Care?"); criar skill a partir do documento Guia de prevenção de glosas por operadora?`,
          proposal: 'Skill que verifica a regra da operadora e já prepara o pedido de autorização retroativa dentro do prazo de 24 horas.' },
        { id: 'sau-sg-2', kind: 'regra', title: 'Regra de CRM obrigatório para Integra Planos', status: 'nova', journeyId: J.prd, sourceDocId: 'sau-doc-glosas',
          evidence: '21% das glosas da Integra Planos no último mês foram por honorário sem CRM do executante.',
          proposal: 'Adicionar linha à tabela "Risco de glosa por operadora" bloqueando honorário sem CRM.' },
      ];
    },
  };
}
