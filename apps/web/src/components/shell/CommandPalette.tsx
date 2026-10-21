'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, CornerDownLeft, Workflow, FileText, Scale, Boxes, Plug, Lightbulb, BookOpen, Zap, History, type LucideIcon } from 'lucide-react';
import { useCortex, useOptionalWs } from '@/lib/store';
import { MODULES } from '@/lib/modules';
import { cx } from '@/components/ui';

interface Entry {
  id: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  run: () => void;
}

export function CommandPalette() {
  const open = useCortex((s) => s.paletteOpen);
  const setOpen = useCortex((s) => s.setPaletteOpen);
  const recent = useCortex((s) => s.recent);
  const ws = useOptionalWs();
  const router = useRouter();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQ('');
      setSel(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  const entries = useMemo<Entry[]>(() => {
    const go = (href: string) => () => {
      router.push(href);
      setOpen(false);
    };
    const s = useCortex.getState();
    const actions: Entry[] = [
      { id: 'a-conector', label: 'Novo conector', hint: 'Ação', icon: Zap, run: go('/conectores?novo=1') },
      { id: 'a-promover', label: 'Promover jornada', hint: 'Ação', icon: Zap, run: go('/ambientes') },
      { id: 'a-iniciativa', label: 'Nova iniciativa', hint: 'Ação', icon: Zap, run: go('/iniciativas?nova=1') },
      { id: 'a-tour', label: 'Iniciar jornada guiada', hint: 'Ação', icon: Zap, run: () => { s.setTour({ active: true, detached: false }); setOpen(false); } },
      { id: 'a-apresentacao', label: 'Modo apresentação', hint: 'Ação', icon: Zap, run: () => { s.setPresentation(!s.presentation); setOpen(false); } },
    ];
    const mods: Entry[] = MODULES.map((m) => ({ id: `m-${m.id}`, label: m.label, hint: `Módulo · ${m.group}`, icon: m.icon, run: go(m.href) }));
    if (!ws) return [...actions, ...mods];
    const objs: Entry[] = [
      ...ws.journeys.map((j) => ({ id: j.id, label: j.name, hint: 'Jornada', icon: Workflow, run: go(`/jornadas/studio?id=${j.id}`) })),
      ...ws.contracts.map((c) => ({ id: c.id, label: `Contrato ${c.name}`, hint: 'Contrato de dados', icon: FileText, run: go(`/dados?contrato=${c.id}`) })),
      ...ws.decisionTables.map((t) => ({ id: t.id, label: t.name, hint: 'Regra de negócio', icon: Scale, run: go(`/cerebro?regra=${t.id}`) })),
      ...ws.components.map((c) => ({ id: c.id, label: c.name, hint: `Componente · ${c.type}`, icon: Boxes, run: go(`/catalogo?id=${c.id}`) })),
      ...ws.connectors.map((c) => ({ id: c.id, label: c.name, hint: 'Conector', icon: Plug, run: go(`/conectores?id=${c.id}`) })),
      ...ws.initiatives.map((i) => ({ id: i.id, label: i.title, hint: 'Iniciativa', icon: Lightbulb, run: go(`/iniciativas?id=${i.id}`) })),
      ...ws.documents.map((d) => ({ id: d.id, label: d.title, hint: 'Documento', icon: BookOpen, run: go(`/conhecimento?doc=${d.id}`) })),
    ];
    return [...actions, ...mods, ...objs];
  }, [ws, router, setOpen]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
    if (!t) {
      const rec: Entry[] = recent.map((r) => ({ id: `r-${r.href}`, label: r.label, hint: 'Recente', icon: History, run: () => { router.push(r.href); setOpen(false); } }));
      return [...rec, ...entries.slice(0, 8)];
    }
    return entries
      .filter((e) => `${e.label} ${e.hint}`.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').includes(t))
      .slice(0, 30);
  }, [q, entries, recent, router, setOpen]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center bg-bg/70 pt-[12vh]" onClick={() => setOpen(false)}>
      <div className="w-[620px] max-w-[92vw] animate-fade-in overflow-hidden rounded-card border border-border bg-surface-1 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-border px-4">
          <Search className="h-4 w-4 text-text-muted" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setSel(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setOpen(false);
              if (e.key === 'ArrowDown') { e.preventDefault(); setSel((x) => Math.min(x + 1, filtered.length - 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setSel((x) => Math.max(x - 1, 0)); }
              if (e.key === 'Enter') filtered[sel]?.run();
            }}
            placeholder="Busque jornadas, contratos, regras, componentes… ou digite uma ação"
            className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-text-muted"
            aria-label="Busca global"
          />
        </div>
        <ul className="max-h-[50vh] overflow-auto p-1" role="listbox">
          {filtered.length === 0 && <li className="px-3 py-6 text-center text-sm text-text-muted">Nada encontrado para “{q}”.</li>}
          {filtered.map((e, i) => {
            const Icon = e.icon;
            return (
              <li key={e.id + i} role="option" aria-selected={i === sel}>
                <button
                  onMouseEnter={() => setSel(i)}
                  onClick={e.run}
                  className={cx('flex w-full items-center gap-3 rounded-field px-3 py-2 text-left text-sm', i === sel && 'bg-surface-2')}
                >
                  <Icon className="h-4 w-4 text-accent" strokeWidth={1.5} />
                  <span className="flex-1 truncate">{e.label}</span>
                  <span className="text-xs text-text-muted">{e.hint}</span>
                  {i === sel && <CornerDownLeft className="h-3.5 w-3.5 text-text-muted" />}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
