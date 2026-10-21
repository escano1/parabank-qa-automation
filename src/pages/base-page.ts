import type { Locator, Page } from '@playwright/test';

export type MenuOption =
  | 'Open New Account'
  | 'Accounts Overview'
  | 'Transfer Funds'
  | 'Bill Pay'
  | 'Find Transactions'
  | 'Update Contact Info'
  | 'Request Loan'
  | 'Log Out';

export abstract class BasePage {
  /** Ruta relativa al baseURL, p. ej. "overview.htm". */
  protected abstract readonly path: string;

  readonly title: Locator;
  readonly accountServicesMenu: Locator;
  readonly welcomeMessage: Locator;

  constructor(readonly page: Page) {
    this.title = page.locator('#rightPanel h1.title').locator('visible=true');
    this.accountServicesMenu = page.locator('#leftPanel');
    this.welcomeMessage = page.locator('#leftPanel .smallText');
  }

  async goto(): Promise<void> {
    await this.page.goto(this.path);
  }

  async navigateTo(option: MenuOption): Promise<void> {
    await this.accountServicesMenu.getByRole('link', { name: option, exact: true }).click();
  }
}
