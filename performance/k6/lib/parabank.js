import http from 'k6/http';
import { check, fail } from 'k6';

export const BASE_URL = (__ENV.BASE_URL || 'http://localhost:8080/parabank/').replace(/\/?$/, '/');
export const BANK = `${BASE_URL}services/bank`;
export const SOAP = `${BASE_URL}services/ParaBank`;
export const JSON_HEADERS = { headers: { Accept: 'application/json' } };

/**
 * Las pruebas de carga NO deben ejecutarse contra el demo público compartido (además tiene rate limiting).
 * Se ejecutan contra la instancia local levantada con `docker compose up -d`.
 */
export function guardAgainstPublicDemo() {
  if (BASE_URL.includes('parabank.parasoft.com') && __ENV.ALLOW_PUBLIC !== 'true') {
    fail('Apunta BASE_URL a tu instancia local (docker compose up -d). El demo público no es para pruebas de carga.');
  }
}

/** Registra un cliente nuevo, lo fondea y devuelve los datos que usan las iteraciones. */
export function setupCustomer() {
  const username = `k6${Date.now().toString(36)}`;
  const password = 'K6pass!2026';

  http.get(`${BASE_URL}register.htm`); // crea la sesión requerida por el formulario
  const registration = http.post(`${BASE_URL}register.htm`, {
    'customer.firstName': 'Perf',
    'customer.lastName': 'Tester',
    'customer.address.street': 'Calle 100',
    'customer.address.city': 'Bogota',
    'customer.address.state': 'DC',
    'customer.address.zipCode': '110111',
    'customer.phoneNumber': '3000000000',
    'customer.ssn': '123-45-6789',
    'customer.username': username,
    'customer.password': password,
    repeatedPassword: password,
  });
  if (!check(registration, { 'registro exitoso': (r) => r.status === 200 && r.body.includes('Welcome') })) {
    fail(`No se pudo registrar el cliente de prueba (status ${registration.status})`);
  }

  const customerId = http.get(`${BANK}/login/${username}/${password}`, JSON_HEADERS).json('id');
  const primaryAccountId = http.get(`${BANK}/customers/${customerId}/accounts`, JSON_HEADERS).json('0.id');
  http.post(`${BANK}/deposit?accountId=${primaryAccountId}&amount=1000000`, null, JSON_HEADERS);
  const savingsAccountId = http
    .post(
      `${BANK}/createAccount?customerId=${customerId}&newAccountType=1&fromAccountId=${primaryAccountId}`,
      null,
      JSON_HEADERS,
    )
    .json('id');

  return { username, password, customerId, primaryAccountId, savingsAccountId };
}

export function soapEnvelope(operation, params) {
  const fields = Object.entries(params)
    .map(([k, v]) => `<par:${k}>${v}</par:${k}>`)
    .join('');
  return (
    '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:par="http://service.parabank.parasoft.com/">' +
    `<soapenv:Body><par:${operation}>${fields}</par:${operation}></soapenv:Body></soapenv:Envelope>`
  );
}

export const SOAP_HEADERS = { headers: { 'Content-Type': 'text/xml;charset=UTF-8', SOAPAction: '""' } };
