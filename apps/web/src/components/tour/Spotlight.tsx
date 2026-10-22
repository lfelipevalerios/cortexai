'use client';

import { useEffect, useRef, useState } from 'react';

export type TargetStatus = 'idle' | 'searching' | 'found' | 'missing';

const SEARCH_TIMEOUT_MS = 4000;

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function isVisible(el: HTMLElement): boolean {
  return el.getClientRects().length > 0;
}

/**
 * Procura `[data-tour="<target>"]` (as telas renderizam de forma assíncrona),
 * marca o elemento com data-tour-active="true", rola até ele e acompanha
 * re-renderizações que troquem o nó do DOM.
 */
export function useTourTarget(target: string | undefined, enabled: boolean, stepKey: string) {
  const [state, setState] = useState<{ el: HTMLElement | null; status: TargetStatus }>({ el: null, status: 'idle' });

  useEffect(() => {
    if (!enabled || !target) {
      setState({ el: null, status: 'idle' });
      return;
    }
    const sel = `[data-tour="${typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(target) : target}"]`;
    const started = Date.now();
    let current: HTMLElement | null = null;
    let scrolled = false;
    let raf = 0;
    setState({ el: null, status: 'searching' });

    const check = () => {
      const found = Array.from(document.querySelectorAll<HTMLElement>(sel)).find(isVisible) ?? null;
      if (found !== current) {
        current?.removeAttribute('data-tour-active');
        current = found;
        if (found) {
          found.setAttribute('data-tour-active', 'true');
          if (!scrolled) {
            scrolled = true;
            found.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
          }
          setState({ el: found, status: 'found' });
          return;
        }
      }
      if (!found) {
        const status: TargetStatus = Date.now() - started > SEARCH_TIMEOUT_MS ? 'missing' : 'searching';
        setState((s) => (s.el === null && s.status === status ? s : { el: null, status }));
      }
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; check(); });
    };
    const mo = new MutationObserver(schedule);
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-tour'] });
    const iv = window.setInterval(check, 400);
    check();
    return () => {
      mo.disconnect();
      window.clearInterval(iv);
      if (raf) cancelAnimationFrame(raf);
      current?.removeAttribute('data-tour-active');
    };
  }, [target, enabled, stepKey]);

  return state;
}

/**
 * Véu leve sobre a tela, com um recorte em volta do alvo. Não bloqueia
 * cliques (pointer-events: none) e funciona mesmo quando o alvo está dentro
 * de um modal ou drawer com contexto de empilhamento próprio.
 */
export function Spotlight({ el }: { el: HTMLElement | null }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!el) return;
    let raf = 0;
    const tick = () => {
      const box = ref.current;
      if (box) {
        const r = el.getBoundingClientRect();
        const pad = 6;
        box.style.transform = `translate(${r.left - pad}px, ${r.top - pad}px)`;
        box.style.width = `${r.width + pad * 2}px`;
        box.style.height = `${r.height + pad * 2}px`;
        box.style.opacity = r.width || r.height ? '1' : '0';
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [el]);

  if (!el) return null;
  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-[60] rounded-[16px] opacity-0 transition-opacity duration-200"
      style={{ boxShadow: '0 0 0 200vmax rgba(5, 0, 15, 0.35)' }}
    />
  );
}
