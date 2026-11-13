import { create } from 'zustand';

const KEY = 'pd-active-connection';

function read(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

interface ActiveConnectionState {
  activeId: string | null;
  setActive: (id: string | null) => void;
}

export const useActiveConnectionStore = create<ActiveConnectionState>((set) => ({
  activeId: read(),
  setActive: (id) => {
    try {
      if (id) localStorage.setItem(KEY, id);
      else localStorage.removeItem(KEY);
    } catch {
      // ignore
    }
    set({ activeId: id });
  },
}));
