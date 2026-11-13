import { create } from 'zustand';

export type Theme = 'light' | 'dark';

function readTheme(): Theme {
  try {
    return localStorage.getItem('pd-theme') === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

interface UiState {
  theme: Theme;
  setTheme: (t: Theme) => void;
}

export const useUi = create<UiState>((set) => ({
  theme: readTheme(),
  setTheme: (theme) => {
    try {
      localStorage.setItem('pd-theme', theme);
    } catch {
      // ignore
    }
    document.documentElement.classList.toggle('dark', theme === 'dark');
    set({ theme });
  },
}));

export type ToastTone = 'success' | 'error' | 'info' | 'warning';
export interface ToastItem {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
}

interface ToastState {
  toasts: ToastItem[];
  push: (t: Omit<ToastItem, 'id'>) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;
export const useToasts = create<ToastState>((set, get) => ({
  toasts: [],
  push: (t) => {
    const id = nextId++;
    set({ toasts: [...get().toasts.slice(-3), { ...t, id }] });
    setTimeout(() => get().dismiss(id), t.tone === 'error' ? 7000 : 4500);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((x) => x.id !== id) }),
}));

export const toast = {
  success: (title: string, description?: string) =>
    useToasts.getState().push({ tone: 'success', title, description }),
  error: (title: string, description?: string) =>
    useToasts.getState().push({ tone: 'error', title, description }),
  info: (title: string, description?: string) =>
    useToasts.getState().push({ tone: 'info', title, description }),
  warning: (title: string, description?: string) =>
    useToasts.getState().push({ tone: 'warning', title, description }),
};
