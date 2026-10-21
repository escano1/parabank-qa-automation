import { test, expect } from '../../../src/fixtures';
import type { Account } from '../../../src/api/types';
import { toCents } from '../../../src/utils/money';

test.describe('SOAP · ParaBank Web Service', () => {
  test(
    '[TC-SOAP-001] el WSDL publica las operaciones críticas del contrato',
    {
      tag: ['@smoke', '@contract'],
    },
    async ({ request }) => {
      const response = await request.get('services/ParaBank?wsdl');

      expect(response.status()).toBe(200);
      const wsdl = await response.text();
      expect(wsdl).toContain('targetNamespace="http://service.parabank.parasoft.com/"');
      for (const operation of [
        'login',
        'getAccount',
        'getAccounts',
        'transfer',
        'deposit',
        'withdraw',
        'requestLoan',
      ]) {
        expect(wsdl, `Falta la operación ${operation}`).toContain(`<wsdl:operation name="${operation}">`);
      }
    },
  );

  test(
    '[TC-SOAP-002] login válido devuelve el cliente',
    { tag: ['@smoke', '@critical'] },
    async ({ soap, customer }) => {
      const result = await soap.login(customer.username, customer.password);

      expect(result.status).toBe(200);
      expect(result.fault).toBeUndefined();
      expect(result.body?.customerId).toMatchObject({
        id: customer.id,
        firstName: customer.firstName,
        lastName: customer.lastName,
      });
    },
  );

  test('[TC-SOAP-003] login inválido devuelve un SOAP Fault', { tag: '@regression' }, async ({ soap, customer }) => {
    const result = await soap.login(customer.username, 'incorrecta');

    expect(result.status).toBe(500);
    expect(result.fault).toMatchObject({ faultcode: 'soap:Server', faultstring: 'Invalid username and/or password' });
  });

  test(
    '[TC-SOAP-004] getAccount es consistente con la API REST',
    {
      tag: ['@regression', '@contract'],
    },
    async ({ soap, rest, customer }) => {
      const [soapResult, restResponse] = await Promise.all([
        soap.getAccount(customer.primaryAccountId),
        rest.getAccount(customer.primaryAccountId),
      ]);
      const restAccount = (await restResponse.json()) as Account;

      expect(soapResult.body?.account).toEqual({
        id: restAccount.id,
        customerId: restAccount.customerId,
        type: restAccount.type,
        balance: restAccount.balance,
      });
    },
  );

  test(
    '[TC-SOAP-005] getAccounts devuelve una colección aunque haya una sola cuenta',
    {
      tag: '@regression',
    },
    async ({ soap, customer }) => {
      const result = await soap.getAccounts(customer.id);

      expect(result.status).toBe(200);
      expect(Array.isArray(result.body?.account)).toBe(true);
      expect(result.body?.account.map((a) => a.id)).toContain(customer.primaryAccountId);
    },
  );

  test(
    '[TC-SOAP-006] un depósito por SOAP se refleja en el saldo consultado por REST',
    {
      tag: ['@critical', '@regression'],
    },
    async ({ soap, rest, newAccount }) => {
      const account = await newAccount({ type: 'CHECKING' });

      const result = await soap.deposit(account.id, 75.25);

      expect(result.status).toBe(200);
      expect(result.message).toBe(`Successfully deposited $75.25 to account #${account.id}`);
      const after = (await (await rest.getAccount(account.id)).json()) as Account;
      expect(toCents(after.balance)).toBe(10_000 + 7_525);
    },
  );

  test(
    '[TC-SOAP-007] consultar una cuenta inexistente devuelve un SOAP Fault',
    {
      tag: '@regression',
    },
    async ({ soap }) => {
      const result = await soap.getAccount(1);

      expect(result.status).toBe(500);
      expect(result.fault?.faultstring).toBe('Could not find account #1');
    },
  );
});
