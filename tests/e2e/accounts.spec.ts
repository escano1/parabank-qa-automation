import { test, expect, balanceInCents } from '../../src/fixtures';

test.describe('Cuentas', () => {
  test(
    '[TC-ACC-001] el resumen muestra las cuentas del cliente y el total coincide con la suma',
    {
      tag: ['@smoke', '@mobile'],
    },
    async ({ overviewPage, customer }) => {
      await overviewPage.goto();

      const ids = await overviewPage.accountIds();
      expect(ids).toContain(customer.primaryAccountId);

      let sum = 0;
      for (const id of ids) sum += await overviewPage.balanceOf(id);
      expect(await overviewPage.total()).toBe(sum);
    },
  );

  for (const type of ['SAVINGS', 'CHECKING'] as const) {
    test(
      `[TC-ACC-002] abrir una cuenta ${type} la crea con el depósito mínimo de $100`,
      {
        tag: ['@critical', '@regression'],
      },
      async ({ openAccountPage, overviewPage, rest, customer, newAccount }) => {
        const source = await newAccount({ deposit: 500 });

        await openAccountPage.goto();
        const newAccountId = await openAccountPage.open(type, source.id);

        await expect(openAccountPage.title).toHaveText('Account Opened!');

        // Verificación en backend: tipo, titular y movimiento de fondos.
        const created = await (await rest.getAccount(newAccountId)).json();
        expect(created).toMatchObject({ id: newAccountId, customerId: customer.id, type, balance: 100 });
        expect(await balanceInCents(rest, source.id)).toBe(60_000 - 10_000);

        // Y la nueva cuenta queda visible para el cliente.
        await overviewPage.goto();
        await expect(overviewPage.rowFor(newAccountId)).toBeVisible();
      },
    );
  }
});
