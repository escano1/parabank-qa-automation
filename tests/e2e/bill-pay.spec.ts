import { test, expect, balanceInCents } from '../../src/fixtures';
import type { Payee } from '../../src/pages/bill-pay-page';

const payee: Payee = {
  name: 'Empresa de Energía',
  street: 'Av. Siempre Viva 742',
  city: 'Bogotá',
  state: 'DC',
  zipCode: '110111',
  phoneNumber: '6015551234',
  accountNumber: '54321',
};

test.describe('Pago de servicios', () => {
  test(
    '[TC-BILL-001] pagar un servicio debita el monto de la cuenta seleccionada',
    {
      tag: ['@critical', '@regression'],
    },
    async ({ billPayPage, rest, newAccount }) => {
      const source = await newAccount({ type: 'CHECKING', deposit: 200 });

      await billPayPage.goto();
      await billPayPage.pay(payee, '42.10', source.id);

      await expect(billPayPage.title).toHaveText('Bill Payment Complete');
      await expect(billPayPage.result).toContainText(
        `Bill Payment to ${payee.name} in the amount of $42.10 from account ${source.id} was successful.`,
      );
      expect(await balanceInCents(rest, source.id)).toBe(30_000 - 4_210);
    },
  );

  test(
    '[TC-BILL-002] el formulario vacío muestra los campos obligatorios',
    {
      tag: '@regression',
    },
    async ({ billPayPage }) => {
      await billPayPage.goto();
      await billPayPage.sendButton.click();

      await expect(billPayPage.visibleErrors).toHaveText([
        'Payee name is required.',
        'Address is required.',
        'City is required.',
        'State is required.',
        'Zip Code is required.',
        'Phone number is required.',
        'Account number is required.',
        'Account number is required.',
        'The amount cannot be empty.',
      ]);
      await expect(billPayPage.result).toBeHidden();
    },
  );

  test(
    '[TC-BILL-003] la verificación de cuenta del beneficiario debe coincidir',
    {
      tag: '@regression',
    },
    async ({ billPayPage, customer }) => {
      await billPayPage.goto();
      await billPayPage.pay({ ...payee, verifyAccount: '99999' }, '10', customer.primaryAccountId);

      await expect(billPayPage.visibleErrors).toHaveText(['The account numbers do not match.']);
      await expect(billPayPage.result).toBeHidden();
    },
  );
});
