import { test, expect, ANONYMOUS } from '../../src/fixtures';
import { buildCustomer } from '../../src/data/customer-factory';

test.describe('Autenticación y registro', () => {
  test.use({ storageState: ANONYMOUS });

  test.describe('Registro de cliente', () => {
    test.beforeEach(async ({ registerPage }) => {
      await registerPage.goto();
    });

    test(
      '[TC-AUTH-001] un cliente nuevo se registra y queda autenticado',
      {
        tag: ['@smoke', '@critical', '@mobile'],
      },
      async ({ registerPage }) => {
        const customer = buildCustomer();

        await registerPage.register(customer);

        await expect(registerPage.title).toHaveText(`Welcome ${customer.username}`);
        await expect(registerPage.successMessage).toContainText('Your account was created successfully');
        await expect(registerPage.welcomeMessage).toContainText(`${customer.firstName} ${customer.lastName}`);
      },
    );

    test(
      '[TC-AUTH-002] el formulario vacío muestra todos los campos obligatorios',
      {
        tag: '@regression',
      },
      async ({ registerPage }) => {
        await registerPage.registerButton.click();

        await expect(registerPage.fieldErrors).toHaveText([
          'First name is required.',
          'Last name is required.',
          'Address is required.',
          'City is required.',
          'State is required.',
          'Zip Code is required.',
          'Social Security Number is required.',
          'Username is required.',
          'Password is required.',
          'Password confirmation is required.',
        ]);
      },
    );

    test(
      '[TC-AUTH-003] no permite registrar un username existente',
      {
        tag: '@regression',
      },
      async ({ registerPage, customer }) => {
        await registerPage.register(buildCustomer({ username: customer.username }));

        await expect(registerPage.errorFor('customer.username')).toHaveText('This username already exists.');
        await expect(registerPage.page).toHaveURL(/register\.htm/);
      },
    );

    test(
      '[TC-AUTH-004] valida que la confirmación de contraseña coincida',
      {
        tag: '@regression',
      },
      async ({ registerPage }) => {
        const customer = buildCustomer();

        await registerPage.register(customer, `${customer.password}x`);

        await expect(registerPage.errorFor('repeatedPassword')).toHaveText('Passwords did not match.');
      },
    );

    test(
      '[TC-AUTH-008] acepta nombres y direcciones con tildes y eñes',
      {
        tag: ['@regression', '@known-bug'],
        annotation: {
          type: 'issue',
          description:
            'BUG-008: caracteres no ASCII (ej. "Núñez", "Vía Pública") devuelven HTTP 400 "Character decoding failed".',
        },
      },
      async ({ registerPage }) => {
        test.fail();
        const customer = buildCustomer({
          firstName: 'José',
          lastName: 'Núñez',
          street: 'Vía Pública 123',
          city: 'Bogotá',
        });

        await registerPage.register(customer);

        await expect(registerPage.title).toHaveText(`Welcome ${customer.username}`);
      },
    );

    test(
      '[TC-AUTH-009] un campo que excede su longitud máxima no se reporta como username duplicado',
      {
        tag: ['@regression', '@known-bug'],
        annotation: {
          type: 'issue',
          description:
            'BUG-012: sin validación de longitud; una ciudad de más de 20 caracteres responde "This username already exists."',
        },
      },
      async ({ registerPage }) => {
        test.fail();
        const customer = buildCustomer({ city: 'Las Palmas de Gran Canaria' }); // 26 caracteres, la columna admite 20

        await registerPage.register(customer);

        await expect(registerPage.errorFor('customer.username')).toBeHidden();
      },
    );
  });

  test.describe('Inicio de sesión', () => {
    test.beforeEach(async ({ loginPage }) => {
      await loginPage.goto();
    });

    test(
      '[TC-AUTH-005] login exitoso con credenciales válidas',
      {
        tag: ['@smoke', '@critical', '@mobile'],
      },
      async ({ loginPage, customer }) => {
        await loginPage.login(customer.username, customer.password);

        await expect(loginPage.page).toHaveURL(/overview\.htm/);
        await expect(loginPage.title).toHaveText('Accounts Overview');
        await expect(loginPage.welcomeMessage).toContainText(`${customer.firstName} ${customer.lastName}`);
      },
    );

    const invalidLogins = [
      {
        caso: 'contraseña incorrecta',
        user: 'valid',
        pass: 'Wrong#123',
        error: 'The username and password could not be verified.',
      },
      {
        caso: 'usuario inexistente',
        user: 'no-existe-xyz-000',
        pass: 'Wrong#123',
        error: 'The username and password could not be verified.',
      },
      { caso: 'campos vacíos', user: '', pass: '', error: 'Please enter a username and password.' },
    ];

    for (const { caso, user, pass, error } of invalidLogins) {
      test(`[TC-AUTH-006] login rechazado: ${caso}`, { tag: '@regression' }, async ({ loginPage, customer }) => {
        await loginPage.login(user === 'valid' ? customer.username : user, pass);

        await expect(loginPage.error).toHaveText(error);
        await expect(loginPage.accountServicesMenu).not.toContainText('Account Services');
      });
    }

    test(
      '[TC-AUTH-007] logout cierra la sesión',
      { tag: ['@regression', '@mobile'] },
      async ({ loginPage, customer }) => {
        await loginPage.login(customer.username, customer.password);
        await expect(loginPage.title).toHaveText('Accounts Overview');

        await loginPage.navigateTo('Log Out');

        await expect(loginPage.page).toHaveURL(/index\.htm/);
        await expect(loginPage.loginButton).toBeVisible();
      },
    );
  });
});
