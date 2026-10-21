import type { APIResponse } from '@playwright/test';

const MAX_WAIT_SECONDS = 60;

/**
 * Reintenta la llamada cuando el servidor responde 429, respetando el header Retry-After.
 * El demo público de ParaBank está detrás de Cloudflare con rate limiting; contra la instancia
 * local (Docker) nunca se activa.
 */
export async function withRateLimitRetry(call: () => Promise<APIResponse>, attempts = 4): Promise<APIResponse> {
  for (let attempt = 1; ; attempt++) {
    const response = await call();
    if (response.status() !== 429 || attempt === attempts) return response;
    const retryAfter = Math.min(Number(response.headers()['retry-after'] ?? 30) || 30, MAX_WAIT_SECONDS);
    console.warn(`[rate-limit] 429 recibido. Reintento ${attempt}/${attempts - 1} en ${retryAfter}s`);
    await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
  }
}
