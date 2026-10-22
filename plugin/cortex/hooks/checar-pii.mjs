#!/usr/bin/env node
// Hook PreToolUse (Edit|Write|MultiEdit) do plugin Córtex.
// Política: dado pessoal (CPF, e-mail, telefone...) não pode ir para log nem para a
// resposta sem mascaramento. Bloqueia a edição com exit code 2; a mensagem em stderr
// volta para o Claude, que corrige o código e tenta de novo.
//
// Entrada (stdin, JSON): { hook_event_name, tool_name, tool_input: { file_path, content | old_string/new_string | edits[] } }
// Saída: exit 0 = segue; exit 2 + stderr = bloqueia. Qualquer erro interno → exit 0 (não trava o trabalho).
// Exceção pontual: comentário "cortex-allow-pii" na mesma linha (ex.: testes do próprio mascaramento).

const CODE_EXT = /\.(m?[jt]sx?|cjs|cts|py|java|kt|kts|cs|go|rb|php|scala|swift|rs)$/i;
const PII = /\b(cpf|cnpj|e-?mail|email|telefone|celular|rg|cartao|card_?number|numero_?cartao|data_?nascimento|birth_?date)\b/i;
const MASK = /mascar|mask|anonimi|redact|hash|ofusc|pseudonim|\*\*\*/i;
const LOG = /\b(console\.(log|info|warn|error|debug)|logger\.\w+|log\.(info|debug|warn|error|trace)|logging\.\w+|print(ln)?|System\.out\.print\w*|Console\.Write\w*)\s*\(/;
const RESPONSE = /\b(res\.(json|send|write)|NextResponse\.json|Response\.json|reply\.send|ctx\.body\s*=|return\s+Ok\(|jsonify)\s*\(?/;

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => (data += c));
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', () => resolve(''));
  });
}

function newText(toolName, input) {
  if (!input) return '';
  if (toolName === 'Write') return input.content ?? '';
  if (toolName === 'Edit') return input.new_string ?? '';
  if (Array.isArray(input.edits)) return input.edits.map((e) => e?.new_string ?? '').join('\n');
  return input.content ?? input.new_string ?? '';
}

function findViolations(text) {
  const out = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line || /^(\/\/|#|\*|\/\*)/.test(line) || /cortex-allow-pii/.test(line)) return;
    if (!PII.test(line) || MASK.test(line)) return;
    if (LOG.test(line)) out.push({ linha: i + 1, tipo: 'log', trecho: line.slice(0, 160) });
    else if (RESPONSE.test(line)) out.push({ linha: i + 1, tipo: 'resposta', trecho: line.slice(0, 160) });
  });
  return out;
}

try {
  const payload = JSON.parse((await readStdin()) || '{}');
  const toolName = payload.tool_name ?? '';
  const input = payload.tool_input ?? {};
  const filePath = String(input.file_path ?? '');

  if (!CODE_EXT.test(filePath)) process.exit(0);

  const violations = findViolations(newText(toolName, input));
  if (violations.length === 0) process.exit(0);

  const lines = violations.map((v) => `  - linha ${v.linha} (${v.tipo === 'log' ? 'log' : 'resposta'}): ${v.trecho}`).join('\n');
  process.stderr.write(
    [
      `Bloqueado pela política do Córtex "PII mascarada em canais e logs" (LGPD) em ${filePath}:`,
      lines,
      'Dado pessoal (CPF, e-mail, telefone etc.) não pode ser registrado em log nem devolvido na resposta sem mascaramento.',
      'Corrija: remova o campo, ou aplique a função de mascaramento do projeto (ex.: mascararCpf, mascararEmail) na mesma expressão,',
      'ou passe a saída pelo guardrail de PII. Depois rode a ferramenta MCP validar_contra_padroes no trecho e tente a edição de novo.',
    ].join('\n') + '\n',
  );
  process.exit(2);
} catch {
  process.exit(0);
}
