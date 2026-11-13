// Pin selection, kept client-side as a Set of pin ids (persisted for the tab session).
import { create } from 'zustand';

const KEY = 'pd-selection';

interface Persisted {
  connectionId: string | null;
  ids: string[];
}

function load(): Persisted {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Persisted;
  } catch {
    // ignore
  }
  return { connectionId: null, ids: [] };
}

function save(connectionId: string | null, ids: Set<string>) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ connectionId, ids: [...ids] }));
  } catch {
    // ignore quota errors
  }
}

interface SelectionState {
  connectionId: string | null;
  ids: Set<string>;
  forConnection: (connectionId: string) => void;
  toggle: (id: string) => void;
  addMany: (ids: Iterable<string>) => void;
  removeMany: (ids: Iterable<string>) => void;
  clear: () => void;
}

const initial = load();

export const useSelection = create<SelectionState>((set, get) => ({
  connectionId: initial.connectionId,
  ids: new Set(initial.ids),
  forConnection: (connectionId) => {
    if (get().connectionId === connectionId) return;
    const ids = new Set<string>();
    save(connectionId, ids);
    set({ connectionId, ids });
  },
  toggle: (id) => {
    const ids = new Set(get().ids);
    if (ids.has(id)) ids.delete(id);
    else ids.add(id);
    save(get().connectionId, ids);
    set({ ids });
  },
  addMany: (list) => {
    const ids = new Set(get().ids);
    for (const id of list) ids.add(id);
    save(get().connectionId, ids);
    set({ ids });
  },
  removeMany: (list) => {
    const ids = new Set(get().ids);
    for (const id of list) ids.delete(id);
    save(get().connectionId, ids);
    set({ ids });
  },
  clear: () => {
    save(get().connectionId, new Set());
    set({ ids: new Set() });
  },
}));
