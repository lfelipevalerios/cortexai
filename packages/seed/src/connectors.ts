// Galeria de conectores (seção 4). Logos oficiais não entram: a UI usa ícone da categoria.
import type { ConnectorType } from '@cortex/schemas';

export const CONNECTOR_TYPES: ConnectorType[] = [
  // CRM
  { id: 'salesforce', name: 'Salesforce', category: 'crm', auth: 'oauth2', badge: 'Nativo', description: 'Contas, contatos, casos e oportunidades do Sales e Service Cloud.' },
  { id: 'dynamics365', name: 'Microsoft Dynamics 365', category: 'crm', auth: 'oauth2', badge: 'Nativo', description: 'Clientes, atendimentos e oportunidades via Dataverse.' },
  { id: 'hubspot', name: 'HubSpot', category: 'crm', auth: 'oauth2', badge: 'Nativo', description: 'Contatos, empresas, negócios e tickets.' },
  // ERP
  { id: 'sap-s4hana', name: 'SAP S/4HANA', category: 'erp', auth: 'oauth2', badge: 'Nativo', description: 'Pedidos, faturamento, materiais e contas a receber via OData.' },
  { id: 'totvs-protheus', name: 'TOTVS Protheus', category: 'erp', auth: 'usuario_senha', badge: 'Nativo', description: 'Cadastros, estoque, financeiro e fiscal pela API REST do Protheus.' },
  { id: 'oracle-erp', name: 'Oracle ERP', category: 'erp', auth: 'oauth2', badge: 'Nativo', description: 'Financeiro, compras e projetos do Oracle Fusion Cloud ERP.' },
  // Bancos de dados
  { id: 'postgresql', name: 'PostgreSQL', category: 'banco', auth: 'usuario_senha', badge: 'Nativo', real: true, description: 'Conexão real no protótipo: descobre tabelas, colunas e amostras.' },
  { id: 'sqlserver', name: 'SQL Server', category: 'banco', auth: 'usuario_senha', badge: 'Nativo', description: 'Tabelas e views com captura de mudanças (CDC).' },
  { id: 'oracle-db', name: 'Oracle Database', category: 'banco', auth: 'usuario_senha', badge: 'Nativo', description: 'Esquemas, tabelas e views com replicação por LogMiner.' },
  { id: 'mongodb', name: 'MongoDB', category: 'banco', auth: 'usuario_senha', badge: 'Nativo', description: 'Coleções e documentos com inferência de esquema.' },
  // Plataformas de dados
  { id: 'snowflake', name: 'Snowflake', category: 'plataforma_dados', auth: 'certificado', badge: 'Nativo', description: 'Warehouses, bancos e esquemas com autenticação por par de chaves.' },
  { id: 'databricks', name: 'Databricks', category: 'plataforma_dados', auth: 'api_key', badge: 'Nativo', description: 'Tabelas Delta e Unity Catalog via token de acesso.' },
  { id: 'bigquery', name: 'BigQuery', category: 'plataforma_dados', auth: 'certificado', badge: 'Nativo', description: 'Datasets e tabelas com conta de serviço.' },
  // APIs
  { id: 'rest-openapi', name: 'REST/OpenAPI', category: 'api', auth: 'api_key', badge: 'OpenAPI', real: true, description: 'Importe uma especificação OpenAPI e gere conector e tools automaticamente.' },
  { id: 'graphql', name: 'GraphQL', category: 'api', auth: 'api_key', badge: 'Nativo', description: 'Introspecção do esquema e geração de consultas como tools.' },
  { id: 'soap', name: 'SOAP', category: 'api', auth: 'certificado', badge: 'Nativo', description: 'Serviços legados descritos em WSDL.' },
  // Eventos
  { id: 'kafka', name: 'Kafka', category: 'eventos', auth: 'certificado', badge: 'Nativo', description: 'Tópicos e esquemas do registry como gatilhos de jornada.' },
  { id: 'webhooks', name: 'Webhooks', category: 'eventos', auth: 'api_key', badge: 'Nativo', description: 'Endpoint de entrada assinado para eventos de qualquer sistema.' },
  // Arquivos e documentos
  { id: 'sharepoint', name: 'SharePoint', category: 'arquivos', auth: 'oauth2', badge: 'Nativo', description: 'Bibliotecas de documentos sincronizadas com a base de conhecimento.' },
  { id: 'google-drive', name: 'Google Drive', category: 'arquivos', auth: 'oauth2', badge: 'Nativo', description: 'Pastas compartilhadas sincronizadas com a base de conhecimento.' },
  { id: 'azure-blob', name: 'Azure Blob', category: 'arquivos', auth: 'api_key', badge: 'Nativo', description: 'Contêineres de arquivos para ingestão em lote.' },
  { id: 's3', name: 'S3', category: 'arquivos', auth: 'api_key', badge: 'Nativo', description: 'Buckets de arquivos para ingestão em lote.' },
  // ITSM e engenharia
  { id: 'jira', name: 'Jira', category: 'itsm', auth: 'api_key', badge: 'Nativo', description: 'Projetos, épicos e histórias criadas a partir das ordens de construção.' },
  { id: 'azure-devops', name: 'Azure DevOps', category: 'itsm', auth: 'api_key', badge: 'Nativo', description: 'Boards, repositórios e pipelines.' },
  { id: 'servicenow', name: 'ServiceNow', category: 'itsm', auth: 'oauth2', badge: 'Nativo', description: 'Incidentes, requisições e ordens de serviço.' },
  // MCP externo
  { id: 'mcp-url', name: 'Servidor MCP por URL', category: 'mcp', auth: 'oauth2', badge: 'MCP', description: 'Qualquer servidor MCP remoto; as ferramentas viram tools governadas.' },
  // Setoriais
  { id: 'hl7-fhir', name: 'HL7 FHIR', category: 'setorial', auth: 'oauth2', badge: 'Nativo', industry: 'saude', description: 'Recursos Patient, Encounter, Appointment e ServiceRequest do HIS/PEP.' },
  { id: 'tiss', name: 'TISS', category: 'setorial', auth: 'certificado', badge: 'Nativo', industry: 'saude', description: 'Guias, lotes e demonstrativos de retorno com as operadoras.' },
  { id: 'open-finance', name: 'Open Finance', category: 'setorial', auth: 'certificado', badge: 'Nativo', industry: 'financeiro', description: 'Dados compartilhados com consentimento: contas, cartões e operações de crédito.' },
  { id: 'pix', name: 'PIX', category: 'setorial', auth: 'certificado', badge: 'Nativo', industry: 'financeiro', description: 'Cobranças, devoluções e Mecanismo Especial de Devolução (MED).' },
  { id: 'tmforum', name: 'TM Forum Open APIs', category: 'setorial', auth: 'oauth2', badge: 'OpenAPI', industry: 'telecom', description: 'APIs padrão de billing, catálogo, ordens e trouble ticket (TMF6xx).' },
  { id: 'vtex', name: 'VTEX', category: 'setorial', auth: 'api_key', badge: 'Nativo', industry: 'varejo', description: 'Catálogo, pedidos, estoque e promoções do e-commerce.' },
  { id: 'oms', name: 'OMS', category: 'setorial', auth: 'api_key', badge: 'OpenAPI', industry: 'varejo', description: 'Orquestração de pedidos omnichannel: reserva, separação e retirada em loja.' },
];
