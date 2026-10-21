import { test, expect } from '../../../src/fixtures';
import { customerSchema, expectSchema } from '../../../src/api/schemas';

test.describe('REST · Clientes y autenticación', () => {
  test(
    '[TC-API-001] login con credenciales válidas devuelve el cliente',
    {
      tag: ['@smoke', '@critical'],
    },
    async ({ rest, customer }) => {
      const response = await rest.login(customer.username, customer.password);

      expect(response.status()).toBe(200);
      expect(response.headers()['content-type']).toContain('application/json');
      const body = await response.json();
      expectSchema(body, customerSchema);
      expect(body).toMatchObject({ id: customer.id, firstName: customer.firstName, lastName: customer.lastName });
    },
  );

  test(
    '[TC-API-002] login con contraseña incorrecta es rechazado',
    { tag: '@regression' },
    async ({ rest, customer }) => {
      const response = await rest.login(customer.username, 'incorrecta');

      expect(response.status()).toBe(400);
      expect(await response.text()).toBe('Invalid username and/or password');
    },
  );

  test(
    '[TC-API-003] el cliente persiste los datos enviados en el registro',
    {
      tag: '@regression',
    },
    async ({ rest, customer }) => {
      const response = await rest.getCustomer(customer.id);

      expect(response.status()).toBe(200);
      const body = await response.json();
      expectSchema(body, customerSchema);
      expect(body).toEqual({
        id: customer.id,
        firstName: customer.firstName,
        lastName: customer.lastName,
        address: { street: customer.street, city: customer.city, state: customer.state, zipCode: customer.zipCode },
        phoneNumber: customer.phoneNumber,
        ssn: customer.ssn,
      });
    },
  );

  test('[TC-API-004] consultar un cliente inexistente devuelve 400', { tag: '@regression' }, async ({ rest }) => {
    const response = await rest.getCustomer(1);

    expect(response.status()).toBe(400);
    expect(await response.text()).toContain('Could not find customer #1');
  });
});
