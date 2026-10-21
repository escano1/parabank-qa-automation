import { test as base, expect } from '@playwright/test';
import { loadCustomer, SESSION_FILE, type RegisteredCustomer } from '../data/test-customer';
import { ParaBankRestClient } from '../api/rest-client';
import { ParaBankSoapClient } from '../api/soap-client';
import type { Account } from '../api/types';
import { LoginPage } from '../pages/login-page';
import { RegisterPage } from '../pages/register-page';
import { AccountsOverviewPage } from '../pages/accounts-overview-page';
import { OpenAccountPage } from '../pages/open-account-page';
import { TransferFundsPage } from '../pages/transfer-funds-page';
import { BillPayPage } from '../pages/bill-pay-page';
import { RequestLoanPage } from '../pages/request-loan-page';

export interface NewAccountOptions {
  type?: 'CHECKING' | 'SAVINGS';
  /** Monto a depositar además de los $100 de apertura. */
  deposit?: number;
}

type WorkerFixtures = {
  /** Cliente registrado por el proyecto `setup` (tests/setup/customer.setup.ts). */
  customer: RegisteredCustomer;
};

type TestFixtures = {
  rest: ParaBankRestClient;
  soap: ParaBankSoapClient;
  loginPage: LoginPage;
  registerPage: RegisterPage;
  overviewPage: AccountsOverviewPage;
  openAccountPage: OpenAccountPage;
  transferPage: TransferFundsPage;
  billPayPage: BillPayPage;
  loanPage: RequestLoanPage;
  /**
   * Crea una cuenta exclusiva para el test vía API. Los tests que validan saldos operan sobre sus propias
   * cuentas, así pueden correr en paralelo sobre el mismo cliente sin interferirse.
   */
  newAccount: (options?: NewAccountOptions) => Promise<Account>;
};

export const test = base.extend<TestFixtures, WorkerFixtures>({
  customer: [async ({}, use) => use(loadCustomer()), { scope: 'worker' }],

  // Por defecto los tests arrancan con la sesión del cliente de pruebas.
  // Los escenarios de usuario anónimo lo sobreescriben con `test.use({ storageState: ANONYMOUS })`.
  storageState: SESSION_FILE,

  rest: async ({ request }, use) => use(new ParaBankRestClient(request)),
  soap: async ({ request }, use) => use(new ParaBankSoapClient(request)),

  loginPage: async ({ page }, use) => use(new LoginPage(page)),
  registerPage: async ({ page }, use) => use(new RegisterPage(page)),
  overviewPage: async ({ page }, use) => use(new AccountsOverviewPage(page)),
  openAccountPage: async ({ page }, use) => use(new OpenAccountPage(page)),
  transferPage: async ({ page }, use) => use(new TransferFundsPage(page)),
  billPayPage: async ({ page }, use) => use(new BillPayPage(page)),
  loanPage: async ({ page }, use) => use(new RequestLoanPage(page)),

  newAccount: async ({ rest, customer }, use) => {
    await use(async ({ type = 'SAVINGS', deposit = 0 } = {}) => {
      // BUG-011: con requests concurrentes ParaBank puede generar ids duplicados y fallar la creación.
      // Aquí la cuenta es sólo un dato de prueba, así que se reintenta; el defecto se cubre en TC-API-015.
      let created = await rest.createAccount(customer.id, type, customer.primaryAccountId);
      for (let attempt = 1; !created.ok() && attempt < 3; attempt++) {
        created = await rest.createAccount(customer.id, type, customer.primaryAccountId);
      }
      expect(created.ok(), `No se pudo crear la cuenta: ${await created.text()}`).toBe(true);
      const { id } = (await created.json()) as Account;
      // El depósito de apertura ($100) no se refleja en la respuesta de createAccount (BUG-010):
      // se espera a que el saldo quede persistido antes de entregar la cuenta al test.
      await expect.poll(() => balanceInCents(rest, id), { message: 'Depósito de apertura no aplicado' }).toBe(10_000);
      if (deposit > 0) {
        expect((await rest.deposit(id, deposit)).ok()).toBe(true);
      }
      return (await (await rest.getAccount(id)).json()) as Account;
    });
  },
});

export { expect };

/** Estado de navegador sin sesión, para escenarios de usuario anónimo. */
export const ANONYMOUS = { cookies: [], origins: [] };

/** Saldo actual de una cuenta en centavos (consulta directa al backend). */
export async function balanceInCents(rest: ParaBankRestClient, accountId: number): Promise<number> {
  const response = await rest.getAccount(accountId);
  expect(response.ok()).toBe(true);
  return Math.round(((await response.json()) as Account).balance * 100);
}
