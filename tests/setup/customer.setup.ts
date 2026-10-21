import { test as setup, expect } from '@playwright/test';
import { buildCustomer, toRegistrationForm } from '../../src/data/customer-factory';
import { withRateLimitRetry } from '../../src/api/rate-limit';
import { saveCustomer, SESSION_FILE } from '../../src/data/test-customer';
import { ParaBankRestClient } from '../../src/api/rest-client';
import type { Account, Customer } from '../../src/api/types';

/** Saldo inicial con el que se fondea la cuenta principal del cliente de pruebas. */
const INITIAL_FUNDS = 100_000;

/**
 * Registra UN cliente por ejecución y guarda sus datos + la sesión del navegador.
 *
 * Por qué uno solo: el ambiente público está detrás de Cloudflare con rate limiting (HTTP 429).
 * El aislamiento entre tests paralelos se logra creando cuentas propias por test (fixture `newAccount`).
 */
setup('registrar y fondear el cliente de pruebas', async ({ request }) => {
  setup.setTimeout(5 * 60_000);
  const data = buildCustomer();

  // El registro sólo existe como formulario web; se hace por HTTP para no gastar tiempo de UI.
  // Requiere una sesión previa (JSESSIONID), por eso el GET inicial.
  await withRateLimitRetry(() => request.get('register.htm'));
  const registration = await withRateLimitRetry(() => request.post('register.htm', { form: toRegistrationForm(data) }));
  const html = await registration.text();
  const formErrors = [...html.matchAll(/class="error">([^<]+)</g)].map((m) => m[1]);
  expect(registration.status(), 'El registro del cliente de prueba falló').toBe(200);
  expect(html, `Registro rechazado: ${formErrors.join(' | ') || 'sin mensaje'}`).toContain(`Welcome ${data.username}`);

  const rest = new ParaBankRestClient(request);
  const { id } = (await (await rest.login(data.username, data.password)).json()) as Customer;
  const [primary] = (await (await rest.getAccounts(id)).json()) as Account[];
  expect((await rest.deposit(primary.id, INITIAL_FUNDS)).ok()).toBe(true);

  saveCustomer({ ...data, id, primaryAccountId: primary.id });
  await request.storageState({ path: SESSION_FILE });
});
