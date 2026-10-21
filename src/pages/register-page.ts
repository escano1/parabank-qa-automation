import type { Locator, Page } from '@playwright/test';
import { BasePage } from './base-page';
import { toRegistrationForm, type NewCustomer } from '../data/customer-factory';

export class RegisterPage extends BasePage {
  protected readonly path = 'register.htm';

  readonly registerButton: Locator;
  readonly fieldErrors: Locator;
  readonly successMessage: Locator;

  constructor(page: Page) {
    super(page);
    this.registerButton = page.getByRole('button', { name: 'Register' });
    this.fieldErrors = page.locator('#rightPanel span.error');
    this.successMessage = page.locator('#rightPanel p');
  }

  /** Los ids del formulario contienen puntos ("customer.firstName"), por eso el selector por atributo. */
  field(name: string): Locator {
    return this.page.locator(`[id="${name}"]`);
  }

  errorFor(name: string): Locator {
    return this.page.locator(`[id="${name}.errors"]`);
  }

  async register(customer: NewCustomer, repeatedPassword = customer.password): Promise<void> {
    const form = { ...toRegistrationForm(customer), repeatedPassword };
    for (const [name, value] of Object.entries(form)) {
      await this.field(name).fill(value);
    }
    await this.registerButton.click();
  }
}
