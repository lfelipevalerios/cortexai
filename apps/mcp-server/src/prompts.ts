// Prompts MCP (seção 8): modelos prontos que a IDE oferece como comandos.
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { wsOf, type Scope } from './store.js';
import { listResources } from './resources.js';

function rulesDigest(scope: Scope): string {
  const ws = wsOf(scope);
  const res = listResources(scope);
  const pick = (kind: string) => res.filter((r) => r.kind === kind).slice(0, 12).map((r) => `- ${r.name} → ${r.uri}`);
  const evitar = ws.radar.filter((r) => r.ring === 'evitar').map((r) => r.name);
  return [
    `Workspace: ${ws.workspace.company} (${scope.workspaceId}), ambiente ${scope.env}, projeto ${scope.project}.`,
    '',
    'Regras de negócio:', ...(pick('regras').length ? pick('regras') : ['- (nenhuma carregada)']),
    '',
    'Padrões técnicos e ADRs:', ...[...pick('padroes'), ...pick('adrs')],
    '',
    'Políticas ativas neste ambiente:', ...pick('politicas'),
    '',
    `Stack no anel Evitar: ${evitar.length ? evitar.join(', ') : '(nenhuma)'}`,
  ].join('\n');
}

export function registerPrompts(server: McpServer, scope: Scope, onGet: (name: string) => void) {
  server.registerPrompt(
    'implementar_historia',
    {
      title: 'Implementar história seguindo os padrões do projeto',
      description: 'Implementa uma história ou OC usando apenas o que o cérebro do Córtex define: regras, contratos, componentes homologados e padrões.',
      argsSchema: {
        historia: z.string().describe('Texto da história ou id da OC (ex.: oc-123).'),
        ordemId: z.string().optional().describe('Id da OC, se houver.'),
      },
    },
    ({ historia, ordemId }) => {
      onGet('prompt:implementar_historia');
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: [
                'Implemente a história abaixo seguindo os padrões do projeto definidos no Córtex.',
                '',
                `História: ${historia}`,
                ordemId ? `Ordem de construção: ${ordemId}` : '',
                '',
                'Contexto do projeto:',
                rulesDigest(scope),
                '',
                'Como trabalhar:',
                ordemId ? `1. Leia a OC com obter_ordem({ ordemId: "${ordemId}" }).` : '1. Se houver OC, leia com obter_ordem; senão, use buscar_regra, obter_contrato e listar_componentes para montar o contexto.',
                '2. Reutilize componentes homologados (listar_componentes status=homologado) antes de criar código novo.',
                '3. Registre o plano com registrar_plano e espere aprovação.',
                '4. A cada etapa, rode validar_contra_padroes no código alterado e corrija as violações antes de seguir.',
                '5. Registre registrar_progresso por nó concluído e, no fim, registrar_evidencia com testes e PR.',
                '6. Se o desenho precisar mudar (campo faltando no contrato, regra incompleta), chame propor_mudanca. Não altere o desenho sozinho.',
              ].filter(Boolean).join('\n'),
            },
          },
        ],
      };
    },
  );

  server.registerPrompt(
    'revisar_codigo',
    {
      title: 'Revisar código contra as regras',
      description: 'Revisa um trecho de código contra as regras de negócio, políticas e padrões técnicos do projeto.',
      argsSchema: {
        codigo: z.string().describe('Código a revisar (ou caminho do arquivo).'),
        caminhoArquivo: z.string().optional(),
      },
    },
    ({ codigo, caminhoArquivo }) => {
      onGet('prompt:revisar_codigo');
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: [
                `Revise o código${caminhoArquivo ? ` de ${caminhoArquivo}` : ''} contra as regras do projeto.`,
                '',
                '```',
                codigo,
                '```',
                '',
                'Contexto do projeto:',
                rulesDigest(scope),
                '',
                'Passos: 1) chame validar_contra_padroes com o código; 2) leia os recursos das regras citadas; 3) confira se as regras de negócio implementadas batem com as tabelas de decisão (buscar_regra) e se os campos batem com os contratos (obter_contrato); 4) devolva uma lista de achados com severidade, linha e a regra de origem (URI cortex://).',
              ].join('\n'),
            },
          },
        ],
      };
    },
  );
}
