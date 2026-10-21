import type { Locator, Page } from '@playwright/test';
import { BasePage } from './base-page';

export class LoginPage extends BasePage {
  protected readonly path = 'index.htm';

  readonly username: Locator;
  readonly password: Locator;
  readonly loginButton: Locator;
  readonly registerLink: Locator;
  readonly error: Locator;

  constructor(page: Page) {
    super(page);
    const form = page.locator('form[name="login"]');
    this.username = form.locator('input[name="username"]');
    this.password = form.locator('input[name="password"]');
    this.loginButton = form.getByRole('button', { name: 'Log In' });
    this.registerLink = page.getByRole('link', { name: 'Register' });
    this.error = page.locator('#rightPanel .error');
  }

  async login(username: string, password: string): Promise<void> {
    await this.username.fill(username);
    await this.password.fill(password);
    await this.loginButton.click();
  }
}
