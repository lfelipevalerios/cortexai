'use client';

import { useEffect, useRef } from 'react';

// Barramento entre telas e jornada guiada.
// - A tela registra ações automáticas (piloto automático) com useAutoAction.
// - A tela emite ações concluídas com emitTourAction; passos com
//   advanceOn "action:<id>" avançam quando a ação chega.

type Handler = () => void | Promise<void>;
const handlers = new Map<string, Handler>();
const listeners = new Set<(id: string) => void>();

export function emitTourAction(id: string) {
  listeners.forEach((l) => l(id));
}

export function onTourAction(fn: (id: string) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function runAutoAction(id: string): Promise<boolean> {
  const h = handlers.get(id);
  if (!h) return false;
  await h();
  return true;
}

export function hasAutoAction(id: string) {
  return handlers.has(id);
}

/** Registra a ação do piloto automático enquanto a tela estiver montada. */
export function useAutoAction(id: string, fn: Handler) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    const h: Handler = () => ref.current();
    handlers.set(id, h);
    return () => {
      if (handlers.get(id) === h) handlers.delete(id);
    };
  }, [id]);
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
