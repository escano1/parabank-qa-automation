import { test, expect } from '../../src/fixtures';

test.describe('Solicitud de préstamo', () => {
  test(
    '[TC-LOAN-001] un préstamo aprobado crea una cuenta LOAN para el cliente',
    {
      tag: ['@critical', '@regression'],
    },
    async ({ loanPage, rest, customer, newAccount }) => {
      const source = await newAccount({ type: 'CHECKING', deposit: 900 });

      await loanPage.goto();
      await loanPage.apply('1000', '50', source.id);

      await expect(loanPage.title).toHaveText('Loan Request Processed');
      await expect(loanPage.loanStatus).toHaveText('Approved');
      await expect(loanPage.loanProvider).not.toBeEmpty();
      await expect(loanPage.newAccountId).toHaveText(/^\d+$/);

      const loanAccountId = Number(await loanPage.newAccountId.innerText());
      const loanAccount = await (await rest.getAccount(loanAccountId)).json();
      expect(loanAccount).toMatchObject({ customerId: customer.id, type: 'LOAN' });
    },
  );

  test(
    '[TC-LOAN-002] se rechaza cuando el cliente no tiene fondos suficientes',
    {
      tag: '@regression',
    },
    async ({ loanPage, customer }) => {
      await loanPage.goto();
      await loanPage.apply('50000000', '10000000', customer.primaryAccountId);

      await expect(loanPage.loanStatus).toHaveText('Denied');
      await expect(loanPage.deniedMessage).not.toBeEmpty();
      await expect(loanPage.newAccountId).toBeHidden();
    },
  );
});
