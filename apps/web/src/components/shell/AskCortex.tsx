'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Sparkles, Send, Terminal } from 'lucide-react';
import type { WorkspaceData } from '@cortex/schemas';
import { useCortex, useOptionalWs } from '@/lib/store';
import { Drawer, Button, CodeBlock, cx } from '@/components/ui';

interface Msg {
  from: 'user' | 'cortex';
  text: string;
  links?: { label: string; href: string }[];
  command?: string;
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

/**
 * Pergunte ao Córtex. No modo demonstração as respostas do roteiro são calculadas
 * sobre o próprio workspace; perguntas livres vão para o Claude Code via /cortex:perguntar.
 */
function answer(q: string, ws: WorkspaceData): Msg {
  const t = norm(q);

  const contract = ws.contracts.find((c) => t.includes(norm(c.name)) || t.includes(norm(c.entity)));
  if (contract && (t.includes('jornada') || t.includes('usa'))) {
    const users = ws.journeys.filter((j) => j.versions.some((v) => v.graph.nodes.some((n) => n.contractId === contract.id)));
    return {
      from: 'cortex',
      text: users.length
        ? `${users.length} jornada(s) usam o contrato ${contract.name}: ${users.map((j) => j.name).join('; ')}.`
        : `Nenhuma jornada usa o contrato ${contract.name} hoje.`,
      links: users.map((j) => ({ label: j.name, href: `/jornadas/studio?id=${j.id}` })),
    };
  }

  if (t.includes('bloquead') || t.includes('por que')) {
    const blocked = ws.releases.find((r) => r.status === 'bloqueada');
    const j = blocked && ws.journeys.find((x) => x.id === blocked.journeyId);
    if (j)
      return {
        from: 'cortex',
        text: `A promoção de “${j.name}” para ${blocked!.to.toUpperCase()} foi bloqueada por gate: falta aprovação do dono de negócio ou há problema bloqueante no fluxo. Os gates ficam em Ambientes & releases.`,
        links: [{ label: 'Abrir Ambientes & releases', href: '/ambientes' }],
      };
  }

  if (t.includes('conector') && (t.includes('crie') || t.includes('criar') || t.includes('novo'))) {
    return {
      from: 'cortex',
      text: 'Posso abrir o wizard de cadastro já em Dev. A criação só acontece depois da sua confirmação no último passo.',
      links: [{ label: 'Abrir wizard de conector', href: '/conectores?novo=1' }],
    };
  }

  const doc = ws.retrievals.find((r) => norm(r.question).split(' ').filter((w) => w.length > 4).every((w) => t.includes(w)));
  if (doc) {
    const src = ws.documents.find((d) => d.id === doc.results[0]?.docId);
    return { from: 'cortex', text: `${doc.answer}${src ? ` Fonte: ${src.title}.` : ''}`, links: src ? [{ label: src.title, href: `/conhecimento?doc=${src.id}` }] : [] };
  }

  return {
    from: 'cortex',
    text: 'Essa pergunta não está no roteiro da demonstração. Perguntas livres são respondidas no Claude Code, com a sua licença, pelo comando abaixo. A resposta volta registrada aqui no histórico.',
    command: `/cortex:perguntar "${q.replace(/"/g, "'")}"`,
  };
}

export function AskCortex() {
  const open = useCortex((s) => s.askOpen);
  const setOpen = useCortex((s) => s.setAskOpen);
  const ws = useOptionalWs();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState('');
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => end.current?.scrollIntoView({ behavior: 'smooth' }), [msgs]);

  if (!ws) return null;
  const firstContract = ws.contracts[0]?.name ?? 'Cliente';
  const suggestions = [`Quais jornadas usam o contrato ${firstContract}?`, 'Crie um conector para o ERP em Dev', 'Por que a jornada foi bloqueada?', ws.retrievals[0]?.question].filter(Boolean) as string[];

  const ask = (text: string) => {
    if (!text.trim()) return;
    setMsgs((m) => [...m, { from: 'user', text }, answer(text, ws)]);
    setQ('');
  };

  return (
    <Drawer open={open} onClose={() => setOpen(false)} title={<span className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-accent" /> Pergunte ao Córtex</span>} subtitle={`Responde sobre o workspace ${ws.workspace.company}`} width={420}
      footer={
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); ask(q); }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pergunte sobre jornadas, contratos, regras…" className="h-10 flex-1 rounded-full border border-border bg-surface-2 px-4 text-sm outline-none focus:border-primary" aria-label="Pergunta" />
          <Button type="submit" variant="primary" icon={Send} aria-label="Enviar" />
        </form>
      }
    >
      {msgs.length === 0 && (
        <div className="space-y-2">
          <p className="text-sm text-text-muted">Sugestões:</p>
          {suggestions.map((s) => (
            <button key={s} onClick={() => ask(s)} className="block w-full rounded-field border border-border px-3 py-2 text-left text-sm hover:border-accent">
              {s}
            </button>
          ))}
        </div>
      )}
      <div className="space-y-3">
        {msgs.map((m, i) => (
          <div key={i} className={cx('rounded-card px-3 py-2 text-sm', m.from === 'user' ? 'ml-8 bg-accent/15' : 'mr-4 border border-border bg-surface-2')}>
            <p>{m.text}</p>
            {m.links && m.links.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {m.links.map((l) => (
                  <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="text-xs font-medium text-primary-soft hover:underline">
                    {l.label} →
                  </Link>
                ))}
              </div>
            )}
            {m.command && (
              <div className="mt-2">
                <div className="mb-1 flex items-center gap-1 text-xs text-text-muted"><Terminal className="h-3 w-3" /> executado no Claude Code</div>
                <CodeBlock code={m.command} />
              </div>
            )}
          </div>
        ))}
        <div ref={end} />
      </div>
    </Drawer>
  );
}
