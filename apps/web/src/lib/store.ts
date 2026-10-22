'use client';

import { create } from 'zustand';

// Estado só de interface. Os dados vêm da API (lib/api.ts).

export interface Toast {
  id: number;
  kind: 'sucesso' | 'erro' | 'info';
  title: string;
}

interface UiState {
  toasts: Toast[];
  toast: (kind: Toast['kind'], title: string) => void;
}

let seq = 1;

export const useUi = create<UiState>()((set) => ({
  toasts: [],
  toast: (kind, title) => {
    const id = seq++;
    set((s) => ({ toasts: [...s.toasts, { id, kind, title }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3500);
  },
}));

export const toast = (kind: Toast['kind'], title: string) => useUi.getState().toast(kind, title);
