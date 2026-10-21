import { test, expect, balanceInCents } from '../../../src/fixtures';
import { accountListSchema, accountSchema, expectSchema, transactionListSchema } from '../../../src/api/schemas';

test.describe('REST · Cuentas', () => {
  test(
    '[TC-API-010] lista las cuentas del cliente con el contrato esperado',
    {
      tag: ['@smoke', '@critical'],
    },
    async ({ rest, customer }) => {
      const response = await rest.getAccounts(customer.id);

      expect(response.status()).toBe(200);
      const accounts = await response.json();
      expectSchema(accounts, accountListSchema);
      expect(accounts.length).toBeGreaterThanOrEqual(1);
      expect(accounts.every((a) => a.customerId === customer.id)).toBe(true);
      expect(accounts.map((a) => a.id)).toContain(customer.primaryAccountId);
    },
  );

  for (const type of ['CHECKING', 'SAVINGS'] as const) {
    test(
      `[TC-API-011] crear cuenta ${type} transfiere el depósito inicial desde la cuenta origen`,
      {
        tag: '@regression',
      },
      async ({ rest, customer, newAccount }) => {
        const source = await newAccount({ deposit: 400 });

        const response = await rest.createAccount(customer.id, type, source.id);

        expect(response.status()).toBe(200);
        const created = await response.json();
        expectSchema(created, accountSchema);
        expect(created).toMatchObject({ customerId: customer.id, type });
        await expect.poll(() => balanceInCents(rest, created.id)).toBe(10_000);
        expect(await balanceInCents(rest, source.id)).toBe(50_000 - 10_000);
      },
    );
  }

  test(
    '[TC-API-014] la respuesta de createAccount refleja el depósito de apertura',
    {
      tag: ['@regression', '@known-bug'],
      annotation: {
        type: 'issue',
        description: 'BUG-010: createAccount responde balance 0 aunque la cuenta queda persistida con $100.',
      },
    },
    async ({ rest, customer }) => {
      test.fail();
      const response = await rest.createAccount(customer.id, 'SAVINGS', customer.primaryAccountId);

      expect((await response.json()).balance).toBe(100);
    },
  );

  test(
    '[TC-API-015] aperturas concurrentes de cuentas no fallan ni duplican ids',
    {
      tag: ['@regression', '@known-bug', '@concurrency'],
      annotation: {
        type: 'issue',
        description:
          'BUG-011: JdbcSequenceDao.getNextId lee y actualiza el id sin atomicidad; requests concurrentes fallan con DuplicateKeyException.',
      },
    },
    async ({ rest, customer }) => {
      test.fail();
      const CONCURRENT_REQUESTS = 30;

      const responses = await Promise.all(
        Array.from({ length: CONCURRENT_REQUESTS }, () =>
          rest.createAccount(customer.id, 'SAVINGS', customer.primaryAccountId),
        ),
      );

      const failed = responses.filter((r) => !r.ok()).length;
      expect(failed, `${failed}/${CONCURRENT_REQUESTS} aperturas fallaron`).toBe(0);
    },
  );

  test('[TC-API-012] consultar una cuenta inexistente devuelve 400', { tag: '@regression' }, async ({ rest }) => {
    const response = await rest.getAccount(1);

    expect(response.status()).toBe(400);
    expect(await response.text()).toBe('Could not find account #1');
  });

  test(
    '[TC-API-013] el historial de transacciones cumple el contrato',
    {
      tag: '@regression',
    },
    async ({ rest, newAccount }) => {
      const account = await newAccount({ deposit: 10 });

      const response = await rest.getTransactions(account.id);

      expect(response.status()).toBe(200);
      const transactions = await response.json();
      expectSchema(transactions, transactionListSchema);
      expect(transactions).toContainEqual(
        expect.objectContaining({
          accountId: account.id,
          type: 'Credit',
          amount: 10,
          description: 'Deposit via Web Service',
        }),
      );
    },
  );
});
