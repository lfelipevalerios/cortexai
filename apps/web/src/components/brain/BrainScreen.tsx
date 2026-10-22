'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Brain, Target, Workflow, Route, Network, Code2, ShieldCheck, Database, Palette, ChevronRight, Pencil, Trash2, ArrowLeft, UserRound,
  type LucideIcon,
} from 'lucide-react';
import { CAPABILITIES, type CapabilityId, type TreeNode } from '@cortex/schemas';
import { api, keys } from '@/lib/api';
import { setAuthor, useAuthor } from '@/lib/author';
import { toast } from '@/lib/store';
import { Logo } from '@/components/Logo';
import { ErrorState, Loading } from '@/components/States';
import { Button, Field, IconButton, Input, Modal, NameModal, cx } from '@/components/ui';
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

const HINTS: Record<string, string> = {
  core: 'Informações globais da empresa: cadastro, estrutura, produtos, números e glossário. Vale para todas as frentes.',
  front: 'Objetivos, indicadores e contexto desta frente.',
  journey: 'Visão geral da jornada: objetivo, público e resultado esperado.',
  design: 'Etapas, canais, regras de negócio e exceções da jornada.',
};

export function BrainScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const wsId = params.get('ws');
  const frontId = params.get('frente');
  const journeyId = params.get('jornada');
  const [panelId, setPanelId] = useState<string | null>(null);
  const [modal, setModal] = useState<null | 'nova-frente' | 'nova-jornada' | 'renomear' | 'autor'>(null);

  const workspaces = useQuery({ queryKey: keys.workspaces, queryFn: api.workspaces });
  const tree = useQuery({ queryKey: keys.tree(wsId ?? ''), queryFn: () => api.tree(wsId!), enabled: !!wsId });

  useEffect(() => {
    if (!wsId) router.replace('/');
  }, [wsId, router]);
  // Trocar de nível fecha o painel.
  useEffect(() => setPanelId(null), [wsId, frontId, journeyId]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: keys.tree(wsId!) });
    qc.invalidateQueries({ queryKey: keys.workspaces });
  };
  const go = (f?: string, j?: string) => router.push(`/cerebro/?ws=${wsId}${f ? `&frente=${f}` : ''}${j ? `&jornada=${j}` : ''}`);

  const createNode = useMutation({
    mutationFn: api.createNode,
    onSuccess: ({ id }, input) => {
      refresh();
      if (input.kind === 'front') go(id);
      else go(input.parentId, id);
    },
    onError: (e) => toast('erro', e.message),
  });
  const rename = useMutation({
    mutationFn: (v: { id: string; name: string; summary: string }) => api.updateNode(v.id, { name: v.name, summary: v.summary }),
    onSuccess: refresh,
    onError: (e) => toast('erro', e.message),
  });
  const remove = useMutation({
    mutationFn: api.deleteNode,
    onError: (e) => toast('erro', e.message),
  });

  if (!wsId) return null;
  if (tree.isLoading) return <Loading label="Carregando o cérebro…" />;
  if (tree.error) return <ErrorState error={tree.error} onRetry={() => tree.refetch()} />;

  const { workspace, core } = tree.data!;
  const front = frontId ? core.children.find((f) => f.id === frontId) : undefined;
  const journey = front && journeyId ? front.children.find((j) => j.id === journeyId) : undefined;
  const toggle = (id: string) => setPanelId((cur) => (cur === id ? null : id));

  // ---------- Nível atual ----------
  let center: React.ReactNode;
  let items: OrbitItem[] = [];

  if (journey && front) {
    const design = journey.children.find((c) => c.kind === 'design');
    center = <CenterNode icon={Workflow} label="Jornada" title={journey.name} subtitle={journey.summary} tone="lilac" content={journey} active={panelId === journey.id} onClick={() => toggle(journey.id)} />;
    items = [
      ...(design
        ? [{
            key: design.id,
            tone: 'purple' as const,
            angle: 180,
            node: <OrbitNode icon={Route} label="Negócio" title="Desenho da jornada" subtitle="Etapas, canais e regras" tone="purple" content={design} active={panelId === design.id} onClick={() => toggle(design.id)} />,
          }]
        : []),
      ...journey.children
        .filter((c) => c.kind === 'capability')
        .map((c, i) => ({
          key: c.id,
          tone: 'green' as const,
          angle: CAP_ANGLES[i],
          node: <OrbitNode icon={CAP_ICON[c.capability!]} label="Capacidade técnica" title={c.name} tone="green" content={c} active={panelId === c.id} onClick={() => toggle(c.id)} />,
        })),
    ];
  } else if (front) {
    center = <CenterNode icon={Target} label="Frente de negócio" title={front.name} subtitle={front.summary} tone="purple" content={front} active={panelId === front.id} onClick={() => toggle(front.id)} />;
    items = [
      ...front.children.map((j) => ({
        key: j.id,
        tone: 'lilac' as const,
        node: <OrbitNode icon={Workflow} label="Jornada" title={j.name} subtitle={j.summary} tone="lilac" content={j} onClick={() => go(front.id, j.id)} />,
      })),
      { key: '__add', tone: 'lilac', node: <AddNode label="Nova jornada" onClick={() => setModal('nova-jornada')} /> },
    ];
  } else {
    center = <CenterNode icon={Brain} label="Núcleo" title="Dados mestre" subtitle={workspace.name} tone="green" content={core} active={panelId === core.id} onClick={() => toggle(core.id)} />;
    items = [
      ...core.children.map((f) => ({
        key: f.id,
        tone: 'purple' as const,
        node: (
          <OrbitNode
            icon={Target}
            label="Frente de negócio"
            title={f.name}
            subtitle={`${f.children.length} ${f.children.length === 1 ? 'jornada' : 'jornadas'}`}
            tone="purple"
            content={f}
            onClick={() => go(f.id)}
          />
        ),
      })),
      { key: '__add', tone: 'purple', node: <AddNode label="Nova frente de negócio" onClick={() => setModal('nova-frente')} /> },
    ];
  }

  // ---------- Painel ----------
  const all = flatten(core);
  const panelNode = panelId ? all.find((n) => n.id === panelId) : undefined;
  const panelInfo = panelNode && describe(panelNode, journey);

  const removeCurrent = async () => {
    const target = journey ?? front;
    if (!target) return;
    const what = journey ? 'a jornada' : 'a frente';
    if (!confirm(`Excluir ${what} “${target.name}”? Ela sai do cérebro, mas o histórico fica guardado.`)) return;
    await remove.mutateAsync(target.id);
    toast('sucesso', journey ? 'Jornada excluída' : 'Frente excluída');
    refresh();
    go(journey ? front!.id : undefined);
  };

  const level = journey ? 'jornada' : front ? 'frente' : 'nucleo';

  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-bg px-4">
        <Link href="/" title="Workspaces">
          <Logo />
        </Link>
        <select
          value={workspace.id}
          onChange={(e) => router.push(`/cerebro/?ws=${e.target.value}`)}
          className="h-9 rounded-full border border-border bg-surface-1 px-3 text-sm focus:border-primary focus:outline-none"
          aria-label="Workspace"
        >
          {(workspaces.data ?? [workspace]).map((w) => (
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
        <AuthorChip onClick={() => setModal('autor')} />
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
            {level === 'jornada' && 'Cada item guarda texto e arquivos, com histórico de versões'}
          </p>
          <Orbit key={`${frontId}-${journeyId}`} center={center} items={items} />
        </main>
        {panelNode && panelInfo && (
          <ContentPanel key={panelNode.id} node={panelNode} workspaceId={workspace.id} {...panelInfo} onClose={() => setPanelId(null)} />
        )}
      </div>

      <NameModal open={modal === 'nova-frente'} onClose={() => setModal(null)} title="Nova frente de negócio" submitLabel="Criar" onSave={(name, summary) => createNode.mutate({ parentId: core.id, kind: 'front', name, summary })} />
      <NameModal open={modal === 'nova-jornada'} onClose={() => setModal(null)} title="Nova jornada" submitLabel="Criar" onSave={(name, summary) => front && createNode.mutate({ parentId: front.id, kind: 'journey', name, summary })} />
      <NameModal
        open={modal === 'renomear'}
        onClose={() => setModal(null)}
        title={journey ? 'Renomear jornada' : 'Renomear frente'}
        initial={(journey ?? front) ? { name: (journey ?? front)!.name, summary: (journey ?? front)!.summary } : undefined}
        onSave={(name, summary) => {
          const target = journey ?? front;
          if (target) rename.mutate({ id: target.id, name, summary });
        }}
      />
      <AuthorModal open={modal === 'autor'} onClose={() => setModal(null)} />
    </div>
  );
}

function flatten(n: TreeNode): TreeNode[] {
  return [n, ...n.children.flatMap(flatten)];
}

function describe(n: TreeNode, journey?: TreeNode) {
  if (n.kind === 'capability') {
    const c = CAPABILITIES.find((x) => x.id === n.capability)!;
    return { label: `Capacidade técnica · ${journey?.name ?? ''}`, title: c.label, hint: c.hint };
  }
  const label = { core: 'Núcleo', front: 'Frente de negócio', journey: 'Jornada', design: 'Desenho da jornada' }[n.kind];
  return { label, title: n.kind === 'design' ? (journey?.name ?? n.name) : n.name, hint: HINTS[n.kind] };
}

function AuthorChip({ onClick }: { onClick: () => void }) {
  const author = useAuthor();
  return (
    <button onClick={onClick} title="Quem está editando" className="flex h-9 items-center gap-1.5 rounded-full border border-border bg-surface-1 px-3 text-xs hover:border-accent">
      <UserRound className="h-4 w-4 text-accent" strokeWidth={1.5} />
      {author || 'Sem nome'}
    </button>
  );
}

function AuthorModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const author = useAuthor();
  const [name, setName] = useState(author);
  useEffect(() => {
    if (open) setName(author);
  }, [open, author]);
  const save = () => {
    if (!name.trim()) return;
    setAuthor(name);
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="Quem está editando" footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="primary" onClick={save} disabled={!name.trim()}>Salvar</Button></>}>
      <Field label="Seu nome">
        <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} />
      </Field>
    </Modal>
  );
}
