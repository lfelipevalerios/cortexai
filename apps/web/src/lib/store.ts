'use client';

import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import type { EnvId, ProfileId, WorkspaceData, AuditEvent } from '@cortex/schemas';
import { generateWorkspaces } from '@cortex/seed';

/** "Hoje" da demonstração (mesma data do seed). */
const SEED_TODAY = '2026-10-21';

// Modo demonstração: o estado inteiro vive no navegador e implementa o mesmo
// contrato que o backend do modo conectado vai implementar (ver lib/api.ts).

export interface Toast {
  id: number;
  kind: 'sucesso' | 'aviso' | 'erro' | 'info';
  title: string;
  description?: string;
  undo?: () => void;
  /** Link opcional para o próximo passo sugerido. */
  href?: string;
  hrefLabel?: string;
}

export interface RecentItem {
  label: string;
  href: string;
}

export interface TourState {
  active: boolean;
  scriptId: 'completo' | 'executivo' | 'tecnico';
  stepIndex: number;
  autopilot: boolean;
  /** Apresentador saiu do roteiro para explorar. */
  detached: boolean;
}

interface CortexState {
  hydrated: boolean;
  workspaces: Record<string, WorkspaceData>;
  activeWorkspaceId: string | null;
  env: EnvId;
  profile: ProfileId;
  presentation: boolean;
  showOffers: boolean;
  recent: RecentItem[];
  tour: TourState;
  toasts: Toast[];
  askOpen: boolean;
  paletteOpen: boolean;
  /** Marcadores de progresso da demo (ex.: "crm-conectado"), por workspace. */
  flags: Record<string, Record<string, boolean>>;

  setWorkspace: (id: string) => void;
  setEnv: (env: EnvId) => void;
  setProfile: (p: ProfileId) => void;
  setPresentation: (on: boolean) => void;
  setShowOffers: (on: boolean) => void;
  setAskOpen: (on: boolean) => void;
  setPaletteOpen: (on: boolean) => void;
  pushRecent: (item: RecentItem) => void;
  /** Altera o workspace ativo de forma imutável. Retorna o estado anterior para desfazer. */
  mutate: (fn: (draft: WorkspaceData) => void, audit?: { action: string; object: string }) => WorkspaceData | null;
  replaceWorkspace: (data: WorkspaceData) => void;
  setFlag: (key: string, value?: boolean) => void;
  toast: (t: Omit<Toast, 'id'>) => void;
  dismissToast: (id: number) => void;
  setTour: (patch: Partial<TourState>) => void;
  resetDemo: () => void;
}

function seedMap(): Record<string, WorkspaceData> {
  return Object.fromEntries(generateWorkspaces().map((w) => [w.workspace.id, w]));
}

// localStorage pode lançar (modo privado, cota). A demo continua sem persistência.
const safeStorage: StateStorage = {
  getItem: (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  setItem: (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* cota excedida: ignora */
    }
  },
  removeItem: (k) => {
    try {
      localStorage.removeItem(k);
    } catch {
      /* ignora */
    }
  },
};

let toastSeq = 1;
let auditSeq = 1;

/** Hora atual da demo: o dia do seed com o relógio real, para eventos novos. */
export function demoNow(): string {
  const t = new Date();
  return `${SEED_TODAY}T${t.toISOString().slice(11, 19)}Z`;
}

export const useCortex = create<CortexState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      workspaces: seedMap(),
      activeWorkspaceId: null,
      env: 'dev',
      profile: 'champion',
      presentation: false,
      showOffers: false,
      recent: [],
      tour: { active: false, scriptId: 'completo', stepIndex: 0, autopilot: false, detached: false },
      toasts: [],
      askOpen: false,
      paletteOpen: false,
      flags: {},

      setWorkspace: (id) => set({ activeWorkspaceId: id }),
      setEnv: (env) => set({ env }),
      setProfile: (profile) => set({ profile }),
      setPresentation: (presentation) => set({ presentation }),
      setShowOffers: (showOffers) => set({ showOffers }),
      setAskOpen: (askOpen) => set({ askOpen }),
      setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
      pushRecent: (item) =>
        set((s) => ({ recent: [item, ...s.recent.filter((r) => r.href !== item.href)].slice(0, 8) })),

      mutate: (fn, audit) => {
        const s = get();
        const id = s.activeWorkspaceId;
        if (!id) return null;
        const before = s.workspaces[id];
        const draft = structuredClone(before);
        fn(draft);
        if (audit) {
          const user = draft.users.find((u) => u.profile === s.profile);
          const ev: AuditEvent = {
            id: `audit-live-${Date.now()}-${auditSeq++}`,
            at: demoNow(),
            actor: user?.name ?? 'Usuário da demo',
            profile: s.profile,
            action: audit.action,
            object: audit.object,
            env: s.env,
          };
          draft.audit = [ev, ...draft.audit];
        }
        set({ workspaces: { ...s.workspaces, [id]: draft } });
        return before;
      },
      replaceWorkspace: (data) => set((s) => ({ workspaces: { ...s.workspaces, [data.workspace.id]: data } })),

      setFlag: (key, value = true) =>
        set((s) => {
          const id = s.activeWorkspaceId ?? '_';
          return { flags: { ...s.flags, [id]: { ...(s.flags[id] ?? {}), [key]: value } } };
        }),

      toast: (t) => {
        const id = toastSeq++;
        set((s) => ({ toasts: [...s.toasts, { ...t, id }] }));
        setTimeout(() => get().dismissToast(id), t.undo ? 6000 : 3500);
      },
      dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),

      setTour: (patch) => set((s) => ({ tour: { ...s.tour, ...patch } })),

      resetDemo: () =>
        set((s) => ({
          workspaces: seedMap(),
          flags: {},
          recent: [],
          env: 'dev',
          profile: 'champion',
          tour: { ...s.tour, stepIndex: 0, detached: false },
        })),
    }),
    {
      name: 'cortex-demo-v1',
      storage: createJSONStorage(() => safeStorage),
      skipHydration: true,
      partialize: (s) => ({
        workspaces: s.workspaces,
        activeWorkspaceId: s.activeWorkspaceId,
        env: s.env,
        profile: s.profile,
        recent: s.recent,
        tour: s.tour,
        flags: s.flags,
        showOffers: s.showOffers,
      }),
      onRehydrateStorage: () => () => {
        useCortex.setState({ hydrated: true });
      },
    },
  ),
);

// ---------- Seletores ----------

export function useWs(): WorkspaceData {
  const data = useCortex((s) => (s.activeWorkspaceId ? s.workspaces[s.activeWorkspaceId] : null));
  if (!data) throw new Error('Nenhum workspace ativo');
  return data;
}

export function useOptionalWs(): WorkspaceData | null {
  return useCortex((s) => (s.activeWorkspaceId ? s.workspaces[s.activeWorkspaceId] : null));
}

export function useEnv(): EnvId {
  return useCortex((s) => s.env);
}

export function useProfile(): ProfileId {
  return useCortex((s) => s.profile);
}

export function useFlag(key: string): boolean {
  return useCortex((s) => !!s.flags[s.activeWorkspaceId ?? '_']?.[key]);
}

/** Acesso fora de componentes (ações do piloto automático, por exemplo). */
export const cortex = {
  get: () => useCortex.getState(),
  ws: () => {
    const s = useCortex.getState();
    return s.activeWorkspaceId ? s.workspaces[s.activeWorkspaceId] : null;
  },
};
