import { expect, type APIRequestContext } from '@playwright/test';

export function isPublicDemo(baseURL: string | undefined): boolean {
  return !!baseURL?.includes('parabank.parasoft.com');
}

/**
 * La imagen Docker arranca sin el esquema de base de datos: se crea con initializeDB, que además
 * deja la instancia en un estado conocido. Nunca contra el demo público (reiniciaría los datos de todos).
 */
export async function initializeLocalDatabase(request: APIRequestContext, baseURL: string | undefined): Promise<void> {
  if (isPublicDemo(baseURL)) return;
  const init = await request.post('services/bank/initializeDB');
  expect(init.ok(), `initializeDB falló (${init.status()})`).toBe(true);
}
