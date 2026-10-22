'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Brain, Target, Workflow, Route, Network, Code2, ShieldCheck, Database, Palette, ChevronRight, Pencil, Trash2, ArrowLeft,
  type LucideIcon,
} from 'lucide-react';
import { CAPABILITIES, getContent, type CapabilityId, type NodePath } from '@cortex/schemas';
import { useActiveWorkspace, useCortex } from '@/lib/store';
import { Logo } from '@/components/Logo';
import { Button, IconButton, NameModal, cx } from '@/components/ui';
import { AddNode, CenterNode, Orbit, OrbitNode, type OrbitItem } from './Orbit';
import { ContentPanel } from './ContentPanel';

const CAP_ICON: Record<CapabilityId, LucideIcon> = {
  arquitetura: Network,
  engenharia: Code2,
  seguranca: ShieldCheck,
  dados: Database,
  design_system: Palette,
};

// Desenho da jornada à esquerda (negócio); capacidades técnicas no arco da direita.
const CAP_ANGLES = [-64, -32, 0, 32, 64];

export function BrainScreen() {
  const ws = useActiveWorkspace();
  const workspaces = useCortex((s) => s.workspaces);
  const setActive = useCortex((s) => s.setActive);
  const s = useCortex();
  const router = useRouter();
  const params = useSearchParams();
  const frontId = params.get('frente');
  const journeyId = params.get('jornada');
  const [panel, setPanel] = useState<NodePath | null>(null);
  const [modal, setModal] = useState<null | 'nova-frente' | 'nova-jornada' | 'renomear'>(null);

  useEffect(() => {
    if (!ws) router.replace('/');
  }, [ws, router]);

  // Trocar de nível fecha o painel.
  useEffect(() => setPanel(null), [frontId, journeyId, ws?.id]);

  if (!ws) return null;
  const brain = ws.brain;
  const front = frontId ? brain.fronts.find((f) => f.id === frontId) : undefined;
  const journey = front && journeyId ? front.journeys.find((j) => j.id === journeyId) : undefined;

  const go = (f?: string, j?: string) => router.push(`/cerebro/${f ? `?frente=${f}${j ? `&jornada=${j}` : ''}` : ''}`);
  const same = (a: NodePath | null, b: NodePath) => !!a && JSON.stringify(a) === JSON.stringify(b);
  const toggle = (p: NodePath) => setPanel((cur) => (same(cur, p) ? null : p));

  // ---------- Nível atual ----------
  let center: React.ReactNode;
  let items: OrbitItem[] = [];

  if (journey && front) {
    const jp: NodePath = { kind: 'journey', frontId: front.id, journeyId: journey.id };
    const dp: NodePath = { kind: 'design', frontId: front.id, journeyId: journey.id };
    center = <CenterNode icon={Workflow} label="Jornada" title={journey.name} subtitle={journey.summary} tone="lilac" content={journey.content} active={same(panel, jp)} onClick={() => toggle(jp)} />;
    items = [
      {
        key: 'design',
        tone: 'purple',
        angle: 180,
        node: <OrbitNode icon={Route} label="Negócio" title="Desenho da jornada" subtitle="Etapas, canais e regras" tone="purple" content={journey.design} active={same(panel, dp)} onClick={() => toggle(dp)} />,
      },
      ...CAPABILITIES.map((c, i) => {
        const cp: NodePath = { kind: 'capability', frontId: front.id, journeyId: journey.id, capability: c.id };
        return {
          key: c.id,
          tone: 'green' as const,
          angle: CAP_ANGLES[i],
          node: <OrbitNode icon={CAP_ICON[c.id]} label="Capacidade técnica" title={c.label} tone="green" content={journey.capabilities[c.id]} active={same(panel, cp)} onClick={() => toggle(cp)} />,
        };
      }),
    ];
  } else if (front) {
    const fp: NodePath = { kind: 'front', frontId: front.id };
    center = <CenterNode icon={Target} label="Frente de negócio" title={front.name} subtitle={front.summary} tone="purple" content={front.content} active={same(panel, fp)} onClick={() => toggle(fp)} />;
    items = [
      ...front.journeys.map((j) => ({
        key: j.id,
        tone: 'lilac' as const,
        node: <OrbitNode icon={Workflow} label="Jornada" title={j.name} subtitle={j.summary} tone="lilac" content={j.content} onClick={() => go(front.id, j.id)} />,
      })),
      { key: '__add', tone: 'lilac', node: <AddNode label="Nova jornada" onClick={() => setModal('nova-jornada')} /> },
    ];
  } else {
    const cp: NodePath = { kind: 'core' };
    center = <CenterNode icon={Brain} label="Núcleo" title="Dados mestre" subtitle={ws.name} tone="green" content={brain.core} active={same(panel, cp)} onClick={() => toggle(cp)} />;
    items = [
      ...brain.fronts.map((f) => ({
        key: f.id,
        tone: 'purple' as const,
        node: (
          <OrbitNode
            icon={Target}
            label="Frente de negócio"
            title={f.name}
            subtitle={`${f.journeys.length} ${f.journeys.length === 1 ? 'jornada' : 'jornadas'}`}
            tone="purple"
            content={f.content}
            onClick={() => go(f.id)}
          />
        ),
      })),
      { key: '__add', tone: 'purple', node: <AddNode label="Nova frente de negócio" onClick={() => setModal('nova-frente')} /> },
    ];
  }

  // ---------- Painel ----------
  const panelInfo = (() => {
    if (!panel) return null;
    const content = getContent(brain, panel);
    if (!content) return null;
    switch (panel.kind) {
      case 'core':
        return { label: 'Núcleo', title: 'Dados mestre', hint: 'Informações globais da empresa: cadastro, estrutura, produtos, números e glossário. Vale para todas as frentes.', content };
      case 'front':
        return { label: 'Frente de negócio', title: front!.name, hint: 'Objetivos, indicadores e contexto desta frente.', content };
      case 'journey':
        return { label: 'Jornada', title: journey!.name, hint: 'Visão geral da jornada: objetivo, público e resultado esperado.', content };
      case 'design':
        return { label: 'Desenho da jornada', title: journey!.name, hint: 'Etapas, canais, regras de negócio e exceções da jornada.', content };
      case 'capability': {
        const c = CAPABILITIES.find((x) => x.id === panel.capability)!;
        return { label: `Capacidade técnica · ${journey!.name}`, title: c.label, hint: c.hint, content };
      }
    }
  })();

  const removeCurrent = () => {
    if (journey && front) {
      if (!confirm(`Excluir a jornada “${journey.name}” com todo o conteúdo e arquivos?`)) return;
      s.removeJourney(front.id, journey.id);
      s.toast('sucesso', 'Jornada excluída');
      go(front.id);
    } else if (front) {
      if (!confirm(`Excluir a frente “${front.name}”, suas jornadas e arquivos?`)) return;
      s.removeFront(front.id);
      s.toast('sucesso', 'Frente excluída');
      go();
    }
  };

  const level = journey ? 'jornada' : front ? 'frente' : 'nucleo';

  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-bg px-4">
        <Link href="/" title="Workspaces">
          <Logo />
        </Link>
        <select
          value={ws.id}
          onChange={(e) => {
            setActive(e.target.value);
            router.push('/cerebro/');
          }}
          className="h-9 rounded-full border border-border bg-surface-1 px-3 text-sm focus:border-primary focus:outline-none"
          aria-label="Workspace"
        >
          {workspaces.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>

        <nav aria-label="Caminho" className="flex min-w-0 items-center gap-1 text-sm">
          <ChevronRight className="h-4 w-4 shrink-0 text-text-muted" />
          <button onClick={() => go()} className={cx('rounded-full px-2 py-1 hover:bg-surface-2', level === 'nucleo' ? 'font-medium text-text' : 'text-text-muted')}>
            Cérebro
          </button>
          {front && (
            <>
              <ChevronRight className="h-4 w-4 shrink-0 text-text-muted" />
              <button onClick={() => go(front.id)} className={cx('truncate rounded-full px-2 py-1 hover:bg-surface-2', level === 'frente' ? 'font-medium text-text' : 'text-text-muted')}>
                {front.name}
              </button>
            </>
          )}
          {journey && (
            <>
              <ChevronRight className="h-4 w-4 shrink-0 text-text-muted" />
              <span className="truncate px-2 py-1 font-medium">{journey.name}</span>
            </>
          )}
        </nav>

        <div className="flex-1" />
        {front && (
          <div className="flex items-center gap-1">
            <IconButton icon={Pencil} label={journey ? 'Renomear jornada' : 'Renomear frente'} onClick={() => setModal('renomear')} />
            <IconButton icon={Trash2} label={journey ? 'Excluir jornada' : 'Excluir frente'} onClick={removeCurrent} className="hover:text-danger" />
          </div>
        )}
      </header>

      <div className="flex min-h-0 flex-1">
        <main className="showcase-bg relative min-w-0 flex-1 overflow-hidden">
          {front && (
            <Button variant="ghost" icon={ArrowLeft} className="absolute left-4 top-4 z-10" onClick={() => go(journey ? front.id : undefined)}>
              {journey ? front.name : 'Cérebro'}
            </Button>
          )}
          <p className="pointer-events-none absolute bottom-4 left-1/2 z-10 -translate-x-1/2 text-center text-xs text-text-muted">
            {level === 'nucleo' && 'Clique no núcleo para os dados mestre · clique em uma frente para ver as jornadas'}
            {level === 'frente' && 'Clique no centro para o conteúdo da frente · clique em uma jornada para abri-la'}
            {level === 'jornada' && 'Cada item guarda texto e arquivos'}
          </p>
          <Orbit key={`${frontId}-${journeyId}`} center={center} items={items} />
        </main>
        {panel && panelInfo && <ContentPanel path={panel} {...panelInfo} onClose={() => setPanel(null)} />}
      </div>

      <NameModal open={modal === 'nova-frente'} onClose={() => setModal(null)} title="Nova frente de negócio" submitLabel="Criar" onSave={(n, sm) => go(s.addFront(n, sm))} />
      <NameModal open={modal === 'nova-jornada'} onClose={() => setModal(null)} title="Nova jornada" submitLabel="Criar" onSave={(n, sm) => front && go(front.id, s.addJourney(front.id, n, sm))} />
      <NameModal
        open={modal === 'renomear'}
        onClose={() => setModal(null)}
        title={journey ? 'Renomear jornada' : 'Renomear frente'}
        initial={journey ? { name: journey.name, summary: journey.summary } : front ? { name: front.name, summary: front.summary } : undefined}
        onSave={(n, sm) => {
          if (journey && front) s.renameJourney(front.id, journey.id, n, sm);
          else if (front) s.renameFront(front.id, n, sm);
        }}
      />
    </div>
  );
}
