'use client';

import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import {
  emptyCapabilities, emptyContent, filesUnder, getContent,
  type Attachment, type Brain, type NodePath, type Workspace,
} from '@cortex/schemas';
import { seedWorkspaces } from '@cortex/seed';
import { deleteFile } from './files';

// O conteúdo da árvore fica no navegador (localStorage); os arquivos, no IndexedDB.

export interface Toast {
  id: number;
  kind: 'sucesso' | 'erro' | 'info';
  title: string;
}

interface CortexState {
  hydrated: boolean;
  workspaces: Workspace[];
  activeId: string | null;
  toasts: Toast[];

  setActive: (id: string | null) => void;
  addWorkspace: (name: string, segment: string) => string;
  /** Altera o cérebro do workspace ativo de forma imutável. */
  editBrain: (fn: (brain: Brain) => void) => void;
  setText: (path: NodePath, text: string) => void;
  addAttachment: (path: NodePath, file: Attachment) => void;
  removeAttachment: (path: NodePath, fileId: string) => void;
  addFront: (name: string, summary: string) => string;
  renameFront: (frontId: string, name: string, summary: string) => void;
  removeFront: (frontId: string) => void;
  addJourney: (frontId: string, name: string, summary: string) => string;
  renameJourney: (frontId: string, journeyId: string, name: string, summary: string) => void;
  removeJourney: (frontId: string, journeyId: string) => void;
  toast: (kind: Toast['kind'], title: string) => void;
}

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

const now = () => new Date().toISOString();
const slug = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || 'item';
const uid = (prefix: string, name: string) => `${prefix}-${slug(name)}-${Date.now().toString(36)}`;

let toastSeq = 1;

export const useCortex = create<CortexState>()(
  persist(
    (set, get) => {
      const editBrain = (fn: (brain: Brain) => void) =>
        set((s) => ({
          workspaces: s.workspaces.map((w) => {
            if (w.id !== s.activeId) return w;
            const brain = structuredClone(w.brain);
            fn(brain);
            return { ...w, brain };
          }),
        }));

      const touch = (path: NodePath, fn: (c: NonNullable<ReturnType<typeof getContent>>) => void) =>
        editBrain((b) => {
          const c = getContent(b, path);
          if (!c) return;
          fn(c);
          c.updatedAt = now();
        });

      return {
        hydrated: false,
        workspaces: seedWorkspaces(),
        activeId: null,
        toasts: [],

        setActive: (activeId) => set({ activeId }),
        addWorkspace: (name, segment) => {
          const id = uid('ws', name);
          const ws: Workspace = { id, name, segment, tagline: segment, brain: { core: emptyContent(), fronts: [] } };
          set((s) => ({ workspaces: [...s.workspaces, ws] }));
          return id;
        },
        editBrain,
        setText: (path, text) => touch(path, (c) => (c.text = text)),
        addAttachment: (path, file) => touch(path, (c) => c.files.push(file)),
        removeAttachment: (path, fileId) => {
          touch(path, (c) => (c.files = c.files.filter((f) => f.id !== fileId)));
          deleteFile(fileId);
        },
        addFront: (name, summary) => {
          const id = uid('fr', name);
          editBrain((b) => b.fronts.push({ id, name, summary, content: emptyContent(), journeys: [] }));
          return id;
        },
        renameFront: (frontId, name, summary) =>
          editBrain((b) => {
            const f = b.fronts.find((x) => x.id === frontId);
            if (f) Object.assign(f, { name, summary });
          }),
        removeFront: (frontId) => {
          const ws = get().workspaces.find((w) => w.id === get().activeId);
          const f = ws?.brain.fronts.find((x) => x.id === frontId);
          if (f) filesUnder(f).forEach((a) => deleteFile(a.id));
          editBrain((b) => (b.fronts = b.fronts.filter((x) => x.id !== frontId)));
        },
        addJourney: (frontId, name, summary) => {
          const id = uid('jr', name);
          editBrain((b) =>
            b.fronts
              .find((f) => f.id === frontId)
              ?.journeys.push({ id, name, summary, content: emptyContent(), design: emptyContent(), capabilities: emptyCapabilities() }),
          );
          return id;
        },
        renameJourney: (frontId, journeyId, name, summary) =>
          editBrain((b) => {
            const j = b.fronts.find((f) => f.id === frontId)?.journeys.find((x) => x.id === journeyId);
            if (j) Object.assign(j, { name, summary });
          }),
        removeJourney: (frontId, journeyId) => {
          const ws = get().workspaces.find((w) => w.id === get().activeId);
          const j = ws?.brain.fronts.find((f) => f.id === frontId)?.journeys.find((x) => x.id === journeyId);
          if (j) filesUnder(j).forEach((a) => deleteFile(a.id));
          editBrain((b) => {
            const f = b.fronts.find((x) => x.id === frontId);
            if (f) f.journeys = f.journeys.filter((x) => x.id !== journeyId);
          });
        },
        toast: (kind, title) => {
          const id = toastSeq++;
          set((s) => ({ toasts: [...s.toasts, { id, kind, title }] }));
          setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3000);
        },
      };
    },
    {
      name: 'cortex-v2',
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      skipHydration: true,
      partialize: (s) => ({ workspaces: s.workspaces, activeId: s.activeId }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<CortexState>;
        const valid = Array.isArray(p.workspaces) && p.workspaces.length > 0;
        return { ...current, workspaces: valid ? p.workspaces! : current.workspaces, activeId: valid ? (p.activeId ?? null) : null };
      },
      onRehydrateStorage: () => () => useCortex.setState({ hydrated: true }),
    },
  ),
);

export function useActiveWorkspace(): Workspace | null {
  return useCortex((s) => s.workspaces.find((w) => w.id === s.activeId) ?? null);
}
