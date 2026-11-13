// Applies the saved theme before first paint (light is the default; dark is opt-in only).
try {
  if (localStorage.getItem('pd-theme') === 'dark') document.documentElement.classList.add('dark');
} catch (e) {
  /* storage unavailable */
}
