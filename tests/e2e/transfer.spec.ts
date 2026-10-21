import { test, expect, balanceInCents } from '../../src/fixtures';

test.describe('Transferencias entre cuentas propias', () => {
  test(
    '[TC-TRF-001] transferir actualiza el saldo de origen y destino',
    {
      tag: ['@smoke', '@critical', '@mobile'],
    },
    async ({ transferPage, rest, newAccount }) => {
      const source = await newAccount({ type: 'CHECKING', deposit: 400 });
      const destination = await newAccount({ type: 'SAVINGS' });

      await transferPage.goto();
      await transferPage.transfer('25.50', source.id, destination.id);

      await expect(transferPage.title).toHaveText('Transfer Complete!');
      await expect(transferPage.amountResult).toHaveText('$25.50');
      await expect(transferPage.fromAccountResult).toHaveText(String(source.id));
      await expect(transferPage.toAccountResult).toHaveText(String(destination.id));

      expect(await balanceInCents(rest, source.id)).toBe(50_000 - 2_550);
      expect(await balanceInCents(rest, destination.id)).toBe(10_000 + 2_550);
    },
  );

  for (const { caso, amount } of [
    { caso: 'monto vacío', amount: '' },
    { caso: 'monto no numérico', amount: 'abc' },
  ]) {
    test(
      `[TC-TRF-002] ${caso} muestra un mensaje de validación`,
      {
        tag: ['@regression', '@known-bug'],
        annotation: {
          type: 'issue',
          description:
            'BUG-006: con monto vacío/no numérico la UI muestra "An internal error has occurred" en lugar de la validación de campo.',
        },
      },
      async ({ transferPage, customer }) => {
        test.fail();
        await transferPage.goto();
        await transferPage.transfer(amount, customer.primaryAccountId, customer.primaryAccountId);

        await expect(transferPage.amountError).toHaveText(/The amount cannot be empty|Please enter a valid amount/);
      },
    );
  }
});
