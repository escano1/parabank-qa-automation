import { request as playwrightRequest } from '@playwright/test';
import { test, expect, balanceInCents } from '../../../src/fixtures';
import { ParaBankRestClient } from '../../../src/api/rest-client';
import { expectSchema, transactionListSchema } from '../../../src/api/schemas';

test.describe('REST · Movimientos de dinero', () => {
  test(
    '[TC-API-020] una transferencia mueve el monto exacto y deja trazabilidad',
    {
      tag: ['@smoke', '@critical'],
    },
    async ({ rest, newAccount }) => {
      const source = await newAccount({ type: 'CHECKING', deposit: 400 });
      const destination = await newAccount();

      const response = await rest.transfer(source.id, destination.id, 33.33);

      expect(response.status()).toBe(200);
      expect(await response.text()).toBe(
        `Successfully transferred $33.33 from account #${source.id} to account #${destination.id}`,
      );
      expect(await balanceInCents(rest, source.id)).toBe(50_000 - 3_333);
      expect(await balanceInCents(rest, destination.id)).toBe(10_000 + 3_333);

      // Débito en origen y crédito en destino por el mismo monto.
      const debits = await (await rest.getTransactionsByAmount(source.id, 33.33)).json();
      const credits = await (await rest.getTransactionsByAmount(destination.id, 33.33)).json();
      expectSchema(debits, transactionListSchema);
      expect(debits).toContainEqual(expect.objectContaining({ type: 'Debit', description: 'Funds Transfer Sent' }));
      expect(credits).toContainEqual(
        expect.objectContaining({ type: 'Credit', description: 'Funds Transfer Received' }),
      );
    },
  );

  test('[TC-API-021] depósito y retiro ajustan el saldo', { tag: '@regression' }, async ({ rest, newAccount }) => {
    const account = await newAccount({ type: 'CHECKING' });

    expect((await rest.deposit(account.id, 250.75)).status()).toBe(200);
    expect(await balanceInCents(rest, account.id)).toBe(10_000 + 25_075);

    expect((await rest.withdraw(account.id, 50.25)).status()).toBe(200);
    expect(await balanceInCents(rest, account.id)).toBe(10_000 + 25_075 - 5_025);
  });

  test(
    '[TC-API-022] transferir a una cuenta inexistente devuelve 400 sin mover fondos',
    {
      tag: '@regression',
    },
    async ({ rest, newAccount }) => {
      const source = await newAccount();

      const response = await rest.transfer(source.id, 1, 10);

      expect(response.status()).toBe(400);
      expect(await balanceInCents(rest, source.id)).toBe(10_000);
    },
  );

  test.describe('Reglas de negocio (defectos conocidos)', { tag: '@known-bug' }, () => {
    // Cada caso describe el comportamiento CORRECTO esperado de un banco. ParaBank hoy no lo cumple,
    // por eso se marcan con test.fail(): el pipeline sigue verde y, si el defecto se corrige,
    // el test "pasa inesperadamente" y obliga a actualizar la suite.
    const invalidTransfers = [
      { bug: 'BUG-001', caso: 'monto negativo', amount: -50 },
      { bug: 'BUG-002', caso: 'monto cero', amount: 0 },
      { bug: 'BUG-004', caso: 'monto mayor al saldo disponible (sobregiro)', amount: 5_000 },
    ];

    for (const { bug, caso, amount } of invalidTransfers) {
      test(
        `[TC-API-023] rechaza transferencia con ${caso}`,
        {
          annotation: { type: 'issue', description: `${bug}: la API acepta transferencias con ${caso}.` },
        },
        async ({ rest, newAccount }) => {
          test.fail();
          const [source, destination] = [await newAccount(), await newAccount()];

          const response = await rest.transfer(source.id, destination.id, amount);

          expect(response.status()).toBe(400);
          expect(await balanceInCents(rest, source.id)).toBe(10_000);
        },
      );
    }

    test(
      '[TC-API-023] rechaza transferencia con misma cuenta origen y destino',
      {
        annotation: {
          type: 'issue',
          description: 'BUG-003: la API acepta transferencias a la misma cuenta y genera movimientos.',
        },
      },
      async ({ rest, newAccount }) => {
        test.fail();
        const account = await newAccount();

        const response = await rest.transfer(account.id, account.id, 10);

        expect(response.status()).toBe(400);
      },
    );

    test(
      '[TC-API-024] rechaza retiros con monto negativo',
      {
        annotation: { type: 'issue', description: 'BUG-001: /withdraw con monto negativo incrementa el saldo.' },
      },
      async ({ rest, newAccount }) => {
        test.fail();
        const account = await newAccount({ type: 'CHECKING' });

        const response = await rest.withdraw(account.id, -25);

        expect(response.status()).toBe(400);
        expect(await balanceInCents(rest, account.id)).toBe(10_000);
      },
    );

    test(
      '[TC-API-025] la API exige autenticación para consultar cuentas',
      {
        annotation: {
          type: 'issue',
          description:
            'BUG-005 (seguridad): cualquier cliente anónimo puede consultar saldos de cualquier cuenta (BOLA/IDOR).',
        },
      },
      async ({ customer, baseURL }) => {
        test.fail();
        const anonymous = await playwrightRequest.newContext({ baseURL });
        try {
          const response = await new ParaBankRestClient(anonymous).getAccount(customer.primaryAccountId);
          expect([401, 403]).toContain(response.status());
        } finally {
          await anonymous.dispose();
        }
      },
    );
  });
});
