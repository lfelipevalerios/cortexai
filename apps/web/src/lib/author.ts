'use client';

import { useSyncExternalStore } from 'react';

// Ainda não há login: cada pessoa informa o nome uma vez e ele vai em cada versão gravada.

const KEY = 'cortex-autor';
const listeners = new Set<() => void>();

export function getAuthor(): string {
  try {
    return localStorage.getItem(KEY) ?? '';
  } catch {
    return '';
  }
}

export function setAuthor(name: string) {
  try {
    localStorage.setItem(KEY, name.trim());
  } catch {
    /* sem armazenamento: vale só nesta aba */
  }
  listeners.forEach((l) => l());
}

export function useAuthor(): string {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    getAuthor,
    () => '',
  );
}
