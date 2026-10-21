import type { APIRequestContext, APIResponse } from '@playwright/test';
import { withRateLimitRetry } from './rate-limit';
import { ACCOUNT_TYPE_CODE, type AccountType } from './types';

const BANK = 'services/bank';

type Params = Record<string, string | number>;

/**
 * Cliente delgado sobre la API REST de ParaBank.
 * Devuelve el APIResponse crudo para que cada test decida qué validar (status, headers, body, schema).
 */
export class ParaBankRestClient {
  private readonly headers = { Accept: 'application/json' };

  constructor(private readonly request: APIRequestContext) {}

  private get(path: string): Promise<APIResponse> {
    return withRateLimitRetry(() => this.request.get(`${BANK}/${path}`, { headers: this.headers }));
  }

  private post(path: string, params: Params): Promise<APIResponse> {
    return withRateLimitRetry(() => this.request.post(`${BANK}/${path}`, { headers: this.headers, params }));
  }

  login(username: string, password: string): Promise<APIResponse> {
    return this.get(`login/${encodeURIComponent(username)}/${encodeURIComponent(password)}`);
  }

  getCustomer(customerId: number): Promise<APIResponse> {
    return this.get(`customers/${customerId}`);
  }

  getAccounts(customerId: number): Promise<APIResponse> {
    return this.get(`customers/${customerId}/accounts`);
  }

  getAccount(accountId: number): Promise<APIResponse> {
    return this.get(`accounts/${accountId}`);
  }

  getTransactions(accountId: number): Promise<APIResponse> {
    return this.get(`accounts/${accountId}/transactions`);
  }

  getTransactionsByAmount(accountId: number, amount: number): Promise<APIResponse> {
    return this.get(`accounts/${accountId}/transactions/amount/${amount}`);
  }

  createAccount(customerId: number, type: Exclude<AccountType, 'LOAN'>, fromAccountId: number): Promise<APIResponse> {
    return this.post('createAccount', { customerId, newAccountType: ACCOUNT_TYPE_CODE[type], fromAccountId });
  }

  transfer(fromAccountId: number, toAccountId: number, amount: number): Promise<APIResponse> {
    return this.post('transfer', { fromAccountId, toAccountId, amount });
  }

  deposit(accountId: number, amount: number): Promise<APIResponse> {
    return this.post('deposit', { accountId, amount });
  }

  withdraw(accountId: number, amount: number): Promise<APIResponse> {
    return this.post('withdraw', { accountId, amount });
  }

  requestLoan(customerId: number, amount: number, downPayment: number, fromAccountId: number): Promise<APIResponse> {
    return this.post('requestLoan', { customerId, amount, downPayment, fromAccountId });
  }
}
