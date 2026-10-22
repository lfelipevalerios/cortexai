'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Columns3, List, Plus, X } from 'lucide-react';
import type { Initiative, Journey, Validation } from '@cortex/schemas';
import { formatBRL } from '@cortex/engine';
import { cortex, demoNow, useCortex, useEnv, useWs } from '@/lib/store';
import { emitTourAction, sleep, useAutoAction } from '@/lib/tour-bus';
import { Button, EmptyState, Modal, PageHeader, Select, cx, useCan } from '@/components/ui';
import { InitiativeList, Kanban } from './Board';
import { InitiativeDrawer, type RevealState } from './InitiativeDrawer';
import { EMPTY_FORM, NewInitiativeModal, type IdeaForm } from './NewInitiativeModal';
import { TYPE_LABEL, buildValidation, demoIds, idPrefix, stageIndex } from './shared';

type View = 'quadro' | 'lista';

/** Rascunho mínimo de jornada para iniciativas criadas na sessão (sem jornada no seed). */
function draftJourney(id: string, ini: Initiative, channelId?: string): Journey {
  const at = demoNow();
  return {
    id,
    name: ini.title,
    description: ini.objective,
    type: ini.type === 'eficiencia' || ini.type === 'modernizacao' ? 'automacao' : 'agentica',
    domainId: ini.domainId,
    initiativeId: ini.id,
    triggerLabel: 'Mensagem de canal',
    risk: 'supervisionada',
    brainInputs: ['Objetivos da empresa', 'Componentes homologados do domínio'],
    versions: [{
      version: '0.1.0', createdAt: at, author: 'Champion AI', note: 'Rascunho gerado por /cortex:desenhar a partir da iniciativa.',
      graph: {
        nodes: [
          { id: 'msg', kind: 'gatilho.mensagem', category: 'gatilho', label: 'Mensagem do cliente', position: { x: 0, y: 0 }, channelId },
          { id: 'agente', kind: 'agente.agente', category: 'agente', label: 'Agente da iniciativa', position: { x: 300, y: 0 } },
          { id: 'responder', kind: 'saida.responder', category: 'saida', label: 'Responder no canal', position: { x: 600, y: 0 }, channelId },
        ],
        edges: [
          { id: 'e1', source: 'msg', target: 'agente' },
          { id: 'e2', source: 'agente', target: 'responder' },
        ],
      },
    }],
    envVersions: { dev: '0.1.0', hml: null, prd: null },
    persona: { name: 'Cliente de teste', message: ini.problem },
    script: {
      msg: { input: ini.problem, output: 'Mensagem recebida.', tokens: 0, latencyMs: 40, costBRL: 0 },
      agente: { input: 'Mensagem do cliente', output: `Plano para: ${ini.objective}`, tokens: 900, latencyMs: 1400, costBRL: 0.02 },
      responder: { input: 'Resposta do agente', output: 'Entendi! Já estou cuidando disso e te aviso por aqui assim que concluir.', tokens: 0, latencyMs: 200, costBRL: 0 },
    },
    testCases: [],
    kpis: [ini.metric],
  };
}

export function IniciativasScreen() {
  const ws = useWs();
  const env = useEnv();
  const router = useRouter();
  const params = useSearchParams();
  const mutate = useCortex((s) => s.mutate);
  const toast = useCortex((s) => s.toast);
  const showOffers = useCortex((s) => s.showOffers);
  const canCreate = useCan('criar_iniciativa');
  const canDecide = useCan('decidir_iniciativa');
  const ids = demoIds(ws);

  const [view, setView] = useState<View>('quadro');
  const [fDomain, setFDomain] = useState('');
  const [fType, setFType] = useState('');
  const [fOwner, setFOwner] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<IdeaForm>(() => EMPTY_FORM(ws));
  const [fromExample, setFromExample] = useState(false);
  const [filling, setFilling] = useState(false);
  const [reveal, setReveal] = useState<RevealState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const busyRef = useRef<string | null>(null);

  // Troca de workspace: limpa estado local.
  useEffect(() => {
    setSelectedId(null);
    setFDomain('');
    setFType('');
    setFOwner('');
    setReveal(null);
    setForm(EMPTY_FORM(ws));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws.workspace.id]);

  // ?id= abre a gaveta; ?nova=1 abre o formulário.
  useEffect(() => {
    const id = params.get('id');
    if (id && ws.initiatives.some((i) => i.id === id)) setSelectedId(id);
    if (params.get('nova') === '1') setFormOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const owners = useMemo(() => Array.from(new Set(ws.initiatives.map((i) => i.owner))).sort(), [ws.initiatives]);
  const items = ws.initiatives.filter((i) => (!fDomain || i.domainId === fDomain) && (!fType || i.type === fType) && (!fOwner || i.owner === fOwner));
  const filtered = !!(fDomain || fType || fOwner);
  const selected = ws.initiatives.find((i) => i.id === selectedId) ?? null;
  const totalValue = ws.initiatives.reduce((a, i) => a + i.expectedValueBRL, 0);

  const openInitiative = (id: string) => setSelectedId(id);
  const closeDrawer = () => {
    setSelectedId(null);
    if (params.get('id')) router.replace('/iniciativas');
  };

  const latest = () => cortex.ws()!;

  // ---------- Registrar ideia ----------
  const exampleForm = useCallback((): IdeaForm => {
    const a = latest().initiatives.find((i) => i.id === ids.anchorInitiativeId);
    if (!a) return EMPTY_FORM(ws);
    return { title: a.title, problem: a.problem, objective: a.objective, metric: a.metric, domainId: a.domainId, type: a.type, value: String(a.expectedValueBRL) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.anchorInitiativeId, ws.workspace.id]);

  const submitIdea = (f: IdeaForm, example: boolean) => {
    const anchorId = ids.anchorInitiativeId;
    const isAnchor = example || f.title.trim() === latest().initiatives.find((i) => i.id === anchorId)?.title;
    let targetId = anchorId;
    if (isAnchor) {
      // A iniciativa-âncora já existe no seed: registrar atualiza os campos, sem duplicar.
      mutate((d) => {
        const a = d.initiatives.find((i) => i.id === anchorId);
        if (!a) return;
        Object.assign(a, { title: f.title, problem: f.problem, objective: f.objective, metric: f.metric, domainId: f.domainId, type: f.type });
        if (f.value) a.expectedValueBRL = Number(f.value);
      }, { action: 'Registrou a ideia', object: f.title });
    } else {
      const user = latest().users.find((u) => u.profile === cortex.get().profile);
      targetId = `${idPrefix(ws)}-in-nova-${Date.now().toString(36)}`;
      const ini: Initiative = {
        id: targetId, title: f.title.trim(), type: f.type, domainId: f.domainId, owner: user?.name ?? 'Usuário da demo', stage: 'ideia',
        expectedValueBRL: Number(f.value || 0), health: 'ok', problem: f.problem.trim(), objective: f.objective.trim(), metric: f.metric.trim(),
      };
      mutate((d) => {
        d.initiatives = [ini, ...d.initiatives];
      }, { action: 'Registrou a ideia', object: ini.title });
    }
    setFormOpen(false);
    setFromExample(false);
    setForm(EMPTY_FORM(ws));
    setFDomain('');
    setFType('');
    setFOwner('');
    setView('quadro');
    setHighlightId(targetId);
    setSelectedId(targetId);
    toast({ kind: 'sucesso', title: 'Ideia registrada', description: 'O cérebro ligou a iniciativa aos objetivos da empresa. Próximo passo: validar no cérebro.' });
    emitTourAction('iniciativa.registrar-ideia');
  };

  useAutoAction('iniciativa.registrar-ideia', async () => {
    setSelectedId(null);
    setForm(EMPTY_FORM(ws));
    setFormOpen(true);
    setFilling(true);
    await sleep(500);
    const target = exampleForm();
    let cur: IdeaForm = { ...EMPTY_FORM(ws) };
    for (const key of ['title', 'problem', 'objective', 'metric'] as const) {
      const text = target[key];
      const steps = 6;
      for (let s = 1; s <= steps; s++) {
        cur = { ...cur, [key]: text.slice(0, Math.ceil((text.length * s) / steps)) };
        setForm(cur);
        await sleep(45);
      }
      await sleep(180);
    }
    cur = { ...cur, domainId: target.domainId, type: target.type, value: target.value };
    setForm(cur);
    await sleep(600);
    setFilling(false);
    submitIdea(cur, true);
  });

  // ---------- Validar no cérebro ----------
  const runValidation = async (id: string) => {
    if (busyRef.current) return;
    const ini = latest().initiatives.find((i) => i.id === id);
    if (!ini) return;
    busyRef.current = 'validar';
    setBusy('validar');
    const v: Validation = ini.validation ? { ...ini.validation } : buildValidation(latest(), ini);
    if (!ini.validation) {
      mutate((d) => {
        const x = d.initiatives.find((i) => i.id === id);
        if (x) x.validation = v;
      });
    }
    setReveal({ id, count: 0, running: true });
    for (let i = 1; i <= v.checks.length; i++) {
      await sleep(500);
      setReveal({ id, count: i, running: true });
    }
    await sleep(300);
    mutate((d) => {
      const x = d.initiatives.find((i) => i.id === id);
      if (!x) return;
      if (stageIndex(x.stage) < 1) x.stage = 'validacao';
    }, { action: 'Validou no cérebro (/cortex:validar)', object: ini.title });
    setReveal({ id, count: v.checks.length, running: false });
    busyRef.current = null;
    setBusy(null);
    toast({ kind: 'sucesso', title: 'Validação concluída', description: `${v.reusePct}% de reuso. A decisão de seguir é do patrocinador.` });
    emitTourAction('iniciativa.validar');
  };

  useAutoAction('iniciativa.validar', async () => {
    const id = selectedId ?? ids.anchorInitiativeId;
    if (selectedId !== id) {
      setSelectedId(id);
      await sleep(600);
    }
    await sleep(300);
    await runValidation(id);
  });

  // ---------- Seguir / Rever ----------
  const doSeguir = (id: string) => {
    const ini = latest().initiatives.find((i) => i.id === id);
    if (!ini) return;
    mutate((d) => {
      const x = d.initiatives.find((i) => i.id === id);
      if (!x) return;
      x.validation = { ...(x.validation ?? buildValidation(d, x)), decision: 'seguir' };
      if (stageIndex(x.stage) < 2) x.stage = 'prototipo';
    }, { action: canDecide ? 'Decidiu seguir com a iniciativa' : 'Registrou a decisão do patrocinador (simulada): seguir', object: ini.title });
    setConfirmOpen(false);
    toast({ kind: 'sucesso', title: 'Decisão registrada: seguir', description: 'O protótipo de conversa foi gerado pelo Claude Code para o patrocinador experimentar.' });
    emitTourAction('iniciativa.seguir');
  };

  const onSeguir = () => {
    if (!selected) return;
    if (canDecide) doSeguir(selected.id);
    else setConfirmOpen(true);
  };

  const onRever = () => {
    if (!selected) return;
    const id = selected.id;
    const prev = mutate((d) => {
      const x = d.initiatives.find((i) => i.id === id);
      if (x?.validation) x.validation = { ...x.validation, decision: 'rever' };
    }, { action: 'Pediu para rever a iniciativa', object: selected.title });
    toast({
      kind: 'info', title: 'Decisão registrada: rever', description: 'A iniciativa volta ao dono de negócio com os pontos de atenção.',
      undo: prev ? () => cortex.get().replaceWorkspace(prev) : undefined,
    });
  };

  useAutoAction('iniciativa.seguir', async () => {
    const id = selectedId ?? ids.anchorInitiativeId;
    if (selectedId !== id) {
      setSelectedId(id);
      await sleep(600);
    }
    await sleep(400);
    if (!canDecide) {
      setConfirmOpen(true);
      await sleep(1100);
    }
    doSeguir(id);
  });

  // ---------- Gerar jornada ----------
  const gerarJornada = async (id: string) => {
    const ini = latest().initiatives.find((i) => i.id === id);
    if (!ini) return;
    setBusy('gerar');
    let journeyId = ini.journeyId && latest().journeys.some((j) => j.id === ini.journeyId) ? ini.journeyId : undefined;
    const isNew = !journeyId;
    if (!journeyId) journeyId = `${idPrefix(ws)}-jr-${Date.now().toString(36)}`;
    const jid = journeyId;
    await sleep(500);
    mutate((d) => {
      const x = d.initiatives.find((i) => i.id === id);
      if (!x) return;
      x.journeyId = jid;
      if (stageIndex(x.stage) < 3) x.stage = 'construcao';
      if (isNew) d.journeys = [...d.journeys, draftJourney(jid, x, d.channels.find((c) => c.type === 'whatsapp')?.id)];
    }, { action: 'Gerou a jornada a partir da iniciativa (/cortex:desenhar)', object: ini.title });
    setBusy(null);
    toast({ kind: 'sucesso', title: 'Rascunho da jornada pronto', description: 'Abrindo no Studio, em Dev.' });
    emitTourAction('iniciativa.gerar-jornada');
    router.push(`/jornadas/studio?id=${encodeURIComponent(jid)}`);
  };

  useAutoAction('iniciativa.gerar-jornada', async () => {
    const id = selectedId ?? ids.anchorInitiativeId;
    if (selectedId !== id) {
      setSelectedId(id);
      await sleep(600);
    }
    await sleep(400);
    await gerarJornada(id);
  });

  return (
    <div>
      <PageHeader
        title="Iniciativas"
        subtitle="Uma ideia percorre Ideia, Validação, Protótipo, Construção e Operação. A recomendação é do Córtex; a decisão de avançar é de uma pessoa."
        actions={
          <span data-tour={formOpen ? undefined : 'iniciativa-nova'} className="inline-flex rounded-full">
            <Button
              variant="primary"
              icon={Plus}
              onClick={() => {
                setForm(EMPTY_FORM(ws));
                setFromExample(false);
                setFormOpen(true);
              }}
            >
              Nova iniciativa
            </Button>
          </span>
        }
      >
        <p className="mt-2 text-sm text-text-muted">
          {ws.initiatives.length} iniciativas · <span className="font-semibold text-text">{formatBRL(totalValue).replace(',00', '')}</span> de valor esperado por ano
        </p>
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-48">
          <Select aria-label="Filtrar por domínio" value={fDomain} onChange={(e) => setFDomain(e.target.value)} options={[{ value: '', label: 'Todos os domínios' }, ...ws.domains.map((d) => ({ value: d.id, label: d.name }))]} />
        </div>
        <div className="w-44">
          <Select aria-label="Filtrar por tipo" value={fType} onChange={(e) => setFType(e.target.value)} options={[{ value: '', label: 'Todos os tipos' }, ...Object.entries(TYPE_LABEL).map(([value, label]) => ({ value, label }))]} />
        </div>
        <div className="w-48">
          <Select aria-label="Filtrar por dono" value={fOwner} onChange={(e) => setFOwner(e.target.value)} options={[{ value: '', label: 'Todos os donos' }, ...owners.map((o) => ({ value: o, label: o }))]} />
        </div>
        {filtered && (
          <Button variant="ghost" size="sm" icon={X} onClick={() => { setFDomain(''); setFType(''); setFOwner(''); }}>
            Limpar filtros
          </Button>
        )}
        <div className="ml-auto flex rounded-full border border-border bg-surface-1 p-0.5" role="radiogroup" aria-label="Visualização">
          {([['quadro', 'Quadro', Columns3], ['lista', 'Lista', List]] as const).map(([id, label, Icon]) => (
            <button
              key={id}
              role="radio"
              aria-checked={view === id}
              onClick={() => setView(id)}
              className={cx('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors', view === id ? 'bg-surface-2 text-text' : 'text-text-muted hover:text-text')}
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={1.5} /> {label}
            </button>
          ))}
        </div>
      </div>

      {items.length === 0 && filtered ? (
        <EmptyState
          title="Nenhuma iniciativa com estes filtros"
          description="Ajuste domínio, tipo ou dono para ver o portfólio."
          action={<Button variant="tertiary" onClick={() => { setFDomain(''); setFType(''); setFOwner(''); }}>Limpar filtros</Button>}
        />
      ) : ws.initiatives.length === 0 ? (
        <EmptyState
          title="Nenhuma iniciativa ainda"
          description="Iniciativas são ideias do negócio que o cérebro valida antes de investir."
          action={<Button variant="primary" icon={Plus} onClick={() => setFormOpen(true)}>Registrar a primeira ideia</Button>}
        />
      ) : view === 'quadro' ? (
        <div className="overflow-x-auto pb-2">
          <Kanban ws={ws} items={items} onOpen={openInitiative} highlightId={highlightId} showOffers={showOffers} />
        </div>
      ) : (
        <InitiativeList ws={ws} items={items} onOpen={openInitiative} />
      )}

      <NewInitiativeModal
        open={formOpen}
        onClose={() => { if (!filling) setFormOpen(false); }}
        ws={ws}
        form={form}
        setForm={(f) => { setForm(f); setFromExample(false); }}
        onUseExample={() => { setForm(exampleForm()); setFromExample(true); }}
        onSubmit={() => submitIdea(form, fromExample)}
        allowed={canCreate}
        busy={filling}
      />

      <InitiativeDrawer
        ws={ws}
        ini={selected}
        env={env}
        reveal={reveal}
        canDecide={canDecide}
        busy={busy}
        onClose={closeDrawer}
        onValidate={() => selected && runValidation(selected.id)}
        onSeguir={onSeguir}
        onRever={onRever}
        onGerar={() => selected && gerarJornada(selected.id)}
      />

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Registrar decisão do patrocinador (simulado)"
        subtitle="O perfil ativo não decide go/no-go. Na demo, você registra a decisão em nome do Patrocinador executivo."
        footer={
          <>
            <Button variant="tertiary" onClick={() => setConfirmOpen(false)}>Cancelar</Button>
            <Button variant="primary" onClick={() => selected && doSeguir(selected.id)}>Registrar &quot;Seguir&quot;</Button>
          </>
        }
      >
        <div className="space-y-2 text-sm">
          <p>Ao seguir, a iniciativa vai para <strong>Protótipo</strong> e o Claude Code gera o protótipo de conversa.</p>
          <p className="text-text-muted">A decisão fica na auditoria como registrada em nome do patrocinador, com o seu perfil como autor.</p>
        </div>
      </Modal>
    </div>
  );
}
