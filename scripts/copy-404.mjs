// Vercel serves dist/404.html (with HTTP 404) for any URL that isn't a real route.
// It is the same SPA shell, so React Router renders the branded NotFound page.
import { copyFileSync } from 'node:fs';
copyFileSync('dist/index.html', 'dist/404.html');
console.log('copied dist/index.html -> dist/404.html');
