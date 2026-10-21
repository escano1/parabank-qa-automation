import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from './base-page';

export interface Payee {
  name: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  phoneNumber: string;
  accountNumber: string;
  verifyAccount?: string;
}

export class BillPayPage extends BasePage {
  protected readonly path = 'billpay.htm';

  readonly amount: Locator;
  readonly fromAccount: Locator;
  readonly sendButton: Locator;
  readonly result: Locator;
  readonly visibleErrors: Locator;

  constructor(page: Page) {
    super(page);
    this.amount = page.locator('input[name="amount"]');
    this.fromAccount = page.locator('select[name="fromAccountId"]');
    this.sendButton = page.getByRole('button', { name: 'Send Payment' });
    this.result = page.locator('#billpayResult');
    this.visibleErrors = page.locator('#billpayForm span.error').locator('visible=true');
  }

  private input(name: string): Locator {
    return this.page.locator(`input[name="${name}"]`);
  }

  async pay(payee: Payee, amount: string, fromAccountId: number): Promise<void> {
    await this.input('payee.name').fill(payee.name);
    await this.input('payee.address.street').fill(payee.street);
    await this.input('payee.address.city').fill(payee.city);
    await this.input('payee.address.state').fill(payee.state);
    await this.input('payee.address.zipCode').fill(payee.zipCode);
    await this.input('payee.phoneNumber').fill(payee.phoneNumber);
    await this.input('payee.accountNumber').fill(payee.accountNumber);
    await this.input('verifyAccount').fill(payee.verifyAccount ?? payee.accountNumber);
    await this.amount.fill(amount);
    await expect(this.fromAccount.locator(`option[value="${fromAccountId}"]`)).toBeAttached();
    await this.fromAccount.selectOption(String(fromAccountId));
    await this.sendButton.click();
  }
}
