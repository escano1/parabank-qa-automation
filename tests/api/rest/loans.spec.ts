import { test, expect } from '../../../src/fixtures';
import { expectSchema, loanResponseSchema } from '../../../src/api/schemas';

/**
 * Con la configuración por defecto (procesador "Available Funds") ParaBank evalúa los fondos totales
 * del cliente, no los de la cuenta seleccionada para el pago inicial.
 */
test.describe('REST · Préstamos', () => {
  test(
    '[TC-API-030] préstamo aprobado crea una cuenta LOAN con el monto solicitado',
    {
      tag: ['@critical', '@regression'],
    },
    async ({ rest, customer, newAccount }) => {
      const source = await newAccount({ type: 'CHECKING', deposit: 900 });

      const response = await rest.requestLoan(customer.id, 2000, 100, source.id);

      expect(response.status()).toBe(200);
      const loan = await response.json();
      expectSchema(loan, loanResponseSchema);
      expect(loan.approved).toBe(true);
      expect(loan.accountId).toEqual(expect.any(Number));

      const account = await (await rest.getAccount(loan.accountId!)).json();
      expect(account).toMatchObject({ customerId: customer.id, type: 'LOAN', balance: 2000 });
    },
  );

  test(
    '[TC-API-031] préstamo rechazado cuando el cliente no tiene fondos suficientes',
    {
      tag: '@regression',
    },
    async ({ rest, customer }) => {
      const response = await rest.requestLoan(customer.id, 50_000_000, 10_000_000, customer.primaryAccountId);

      expect(response.status()).toBe(200);
      const loan = await response.json();
      expectSchema(loan, loanResponseSchema);
      expect(loan.approved).toBe(false);
      expect(loan.accountId ?? null).toBeNull();
    },
  );

  test(
    '[TC-API-032] rechaza un pago inicial mayor al saldo de la cuenta seleccionada',
    {
      tag: ['@regression', '@known-bug'],
      annotation: {
        type: 'issue',
        description:
          'BUG-009: se aprueba el préstamo aunque la cuenta origen no cubre el pago inicial (queda en negativo).',
      },
    },
    async ({ rest, customer, newAccount }) => {
      test.fail();
      const source = await newAccount(); // $100 de saldo

      const response = await rest.requestLoan(customer.id, 2000, 500, source.id);

      expect((await response.json()).approved).toBe(false);
    },
  );
});
