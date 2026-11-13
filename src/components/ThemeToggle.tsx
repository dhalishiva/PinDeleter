import { Moon, Sun } from 'lucide-react';
import { useUi } from '@/stores/ui';

export function ThemeToggle({ compact }: { compact?: boolean }) {
  const { theme, setTheme } = useUi();
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={`Switch to ${next} mode`}
      className="inline-flex items-center gap-2 rounded-full border-2 border-line bg-raised px-3 py-1.5 text-sm font-bold text-ink hover:border-violet/40"
    >
      {theme === 'dark' ? (
        <Sun className="h-4 w-4 text-sunflower" aria-hidden />
      ) : (
        <Moon className="h-4 w-4 text-violet" aria-hidden />
      )}
      {!compact && (theme === 'dark' ? 'Light mode' : 'Dark mode')}
    </button>
  );
}
