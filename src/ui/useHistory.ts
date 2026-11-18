import { useCallback, useRef, useState } from 'react';
import type { Project } from '../model/types';

interface State {
  past: Project[];
  present: Project;
  future: Project[];
}

const LIMIT = 80;

/** Stan projektu z cofaniem/ponawianiem. `transient` nie tworzy wpisu w historii (np. przeciąganie). */
export function useHistory(initial: Project) {
  const [state, setState] = useState<State>({ past: [], present: initial, future: [] });
  const checkpoint = useRef<Project | null>(null);

  const update = useCallback((fn: (draft: Project) => void, opts: { transient?: boolean } = {}) => {
    setState((s) => {
      const draft = structuredClone(s.present);
      fn(draft);
      draft.updatedAt = Date.now();
      if (opts.transient) {
        if (!checkpoint.current) checkpoint.current = s.present;
        return { ...s, present: draft };
      }
      const base = checkpoint.current ?? s.present;
      checkpoint.current = null;
      return { past: [...s.past, base].slice(-LIMIT), present: draft, future: [] };
    });
  }, []);

  /** Zamyka serię zmian „transient” jednym wpisem w historii */
  const commit = useCallback(() => {
    setState((s) => {
      if (!checkpoint.current) return s;
      const base = checkpoint.current;
      checkpoint.current = null;
      return { past: [...s.past, base].slice(-LIMIT), present: s.present, future: [] };
    });
  }, []);

  const undo = useCallback(() => {
    setState((s) =>
      s.past.length ? { past: s.past.slice(0, -1), present: s.past[s.past.length - 1], future: [s.present, ...s.future] } : s,
    );
  }, []);
  const redo = useCallback(() => {
    setState((s) => (s.future.length ? { past: [...s.past, s.present], present: s.future[0], future: s.future.slice(1) } : s));
  }, []);
  const reset = useCallback((p: Project) => setState({ past: [], present: p, future: [] }), []);

  return {
    project: state.present,
    update,
    commit,
    undo,
    redo,
    reset,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  };
}
