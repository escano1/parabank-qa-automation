import type { APIRequestContext } from '@playwright/test';
import { XMLParser } from 'fast-xml-parser';
import { withRateLimitRetry } from './rate-limit';

const ENDPOINT = 'services/ParaBank';
const NS = 'http://service.parabank.parasoft.com/';

export interface SoapFault {
  faultcode: string;
  faultstring: string;
}

export interface SoapResult<T> {
  status: number;
  raw: string;
  /** Contenido de `<{operation}Response>` ya parseado, si la llamada fue exitosa. */
  body?: T;
  /** Para operaciones que devuelven un único texto (deposit, transfer...): su valor, sin importar el nombre del tag. */
  message?: string;
  fault?: SoapFault;
}

const parser = new XMLParser({
  removeNSPrefix: true,
  ignoreAttributes: true,
  // Las colecciones con un solo elemento deben seguir siendo arrays.
  isArray: (_name, jpath) => /getAccountsResponse\.account$|getTransactionsResponse\.transaction$/.test(String(jpath)),
});

/**
 * Cliente SOAP 1.1 mínimo para ParaBank: arma el envelope, hace POST con el request context de Playwright
 * y normaliza la respuesta (body o fault) para que los tests no tengan que lidiar con XML.
 */
export class ParaBankSoapClient {
  constructor(private readonly request: APIRequestContext) {}

  static envelope(operation: string, params: Record<string, string | number>): string {
    const fields = Object.entries(params)
      .map(([k, v]) => `<par:${k}>${escapeXml(String(v))}</par:${k}>`)
      .join('');
    return (
      `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:par="${NS}">` +
      `<soapenv:Header/><soapenv:Body><par:${operation}>${fields}</par:${operation}></soapenv:Body></soapenv:Envelope>`
    );
  }

  async call<T>(operation: string, params: Record<string, string | number> = {}): Promise<SoapResult<T>> {
    const response = await withRateLimitRetry(() =>
      this.request.post(ENDPOINT, {
        headers: { 'Content-Type': 'text/xml;charset=UTF-8', SOAPAction: '""' },
        data: ParaBankSoapClient.envelope(operation, params),
      }),
    );
    const raw = await response.text();
    const envelopeBody = parser.parse(raw)?.Envelope?.Body ?? {};
    const body = envelopeBody[`${operation}Response`];
    const values = body && typeof body === 'object' ? Object.values(body) : [];
    return {
      status: response.status(),
      raw,
      body,
      message: values.length === 1 && typeof values[0] === 'string' ? values[0] : undefined,
      fault: envelopeBody.Fault,
    };
  }

  login(username: string, password: string) {
    return this.call<{ customerId: { id: number; firstName: string; lastName: string } }>('login', {
      username,
      password,
    });
  }

  getAccount(accountId: number) {
    return this.call<{ account: { id: number; customerId: number; type: string; balance: number } }>('getAccount', {
      accountId,
    });
  }

  getAccounts(customerId: number) {
    return this.call<{ account: { id: number; customerId: number; type: string; balance: number }[] }>('getAccounts', {
      customerId,
    });
  }

  deposit(accountId: number, amount: number) {
    return this.call('deposit', { accountId, amount });
  }

  transfer(fromAccountId: number, toAccountId: number, amount: number) {
    return this.call('transfer', { fromAccountId, toAccountId, amount });
  }
}

function escapeXml(value: string): string {
  return value.replace(
    /[<>&'"]/g,
    (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!,
  );
}
