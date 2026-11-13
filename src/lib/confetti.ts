export async function celebrate(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const { default: confetti } = await import('canvas-confetti');
  const colors = ['#E60023', '#111111', '#E9E9E9', '#FFE2EB', '#FFFD92', '#DAFFF6'];
  const base = { colors, disableForReducedMotion: true, zIndex: 9999 };
  void confetti({ ...base, particleCount: 90, spread: 70, origin: { y: 0.65 } });
  setTimeout(
    () => void confetti({ ...base, particleCount: 60, angle: 60, spread: 60, origin: { x: 0, y: 0.7 } }),
    180,
  );
  setTimeout(
    () => void confetti({ ...base, particleCount: 60, angle: 120, spread: 60, origin: { x: 1, y: 0.7 } }),
    300,
  );
}
