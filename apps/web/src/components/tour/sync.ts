'use client';

// Sincronização entre a janela principal (TourLayer) e a janela de notas do
// apresentador (/notas): BroadcastChannel, com localStorage como reserva.

import type { TourScript } from '@cortex/schemas';

export const TOUR_CHANNEL = 'cortex-tour';
export const TOUR_SYNC_KEY = 'cortex-tour-sync';

export interface TourSyncState {
  scriptId: TourScript['id'];
  stepIndex: number;
  active: boolean;
  detached: boolean;
  at: number;
}

export type TourSyncMessage =
  | ({ type: 'state' } & TourSyncState)
  | { type: 'hello' }
  | { type: 'cmd'; cmd: 'next' | 'prev' };

export function openTourChannel(): BroadcastChannel | null {
  try {
    return typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(TOUR_CHANNEL);
  } catch {
    return null;
  }
}

export function writeSyncState(state: TourSyncState) {
  try {
    localStorage.setItem(TOUR_SYNC_KEY, JSON.stringify(state));
  } catch {
    /* sem armazenamento: só o canal */
  }
}

export function readSyncState(): TourSyncState | null {
  try {
    const raw = localStorage.getItem(TOUR_SYNC_KEY);
    if (raw) return JSON.parse(raw) as TourSyncState;
    // Reserva: estado persistido do store da demo.
    const persisted = localStorage.getItem('cortex-demo-v1');
    const tour = persisted ? (JSON.parse(persisted) as { state?: { tour?: Omit<TourSyncState, 'at'> } }).state?.tour : undefined;
    return tour ? { ...tour, at: 0 } : null;
  } catch {
    return null;
  }
}

export function openPresenterNotes() {
  window.open('/notas/', 'cortex-notas', 'width=520,height=760');
}
