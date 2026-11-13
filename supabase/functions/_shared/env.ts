// Typed access to environment variables / Supabase secrets.

export function env(name: string, fallback?: string): string {
  const value = Deno.env.get(name);
  if (value !== undefined && value !== '') return value;
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing required environment variable: ${name}`);
}

export function optionalEnv(name: string): string | undefined {
  const value = Deno.env.get(name);
  return value === undefined || value === '' ? undefined : value;
}

export function boolEnv(name: string, fallback = false): boolean {
  const value = optionalEnv(name);
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

export function numberEnv(name: string, fallback: number): number {
  const value = Number(optionalEnv(name));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export const isDevelopment = () => optionalEnv('APP_ENV') === 'development';
export const siteUrl = () => env('SITE_URL', 'https://pindeleter.kriosity.in').replace(/\/+$/, '');
export const isPinterestMock = () => boolEnv('PINTEREST_MOCK', false);
