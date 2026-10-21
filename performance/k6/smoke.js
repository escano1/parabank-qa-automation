import http from 'k6/http';
import { check, group, sleep } from 'k6';
import {
  BANK,
  JSON_HEADERS,
  SOAP,
  SOAP_HEADERS,
  guardAgainstPublicDemo,
  setupCustomer,
  soapEnvelope,
} from './lib/parabank.js';

/**
 * Smoke de performance: 1 VU durante 30s. Valida que los endpoints críticos responden
 * correctamente y dentro del SLO antes de correr pruebas de carga más pesadas.
 */
export const options = {
  vus: 1,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1000'],
    checks: ['rate>0.99'],
  },
};

export function setup() {
  guardAgainstPublicDemo();
  return setupCustomer();
}

export default function (data) {
  group('REST · login', () => {
    const res = http.get(`${BANK}/login/${data.username}/${data.password}`, {
      ...JSON_HEADERS,
      tags: { name: 'login' },
    });
    check(res, {
      'login 200': (r) => r.status === 200,
      'login devuelve el cliente': (r) => r.json('id') === data.customerId,
    });
  });

  group('REST · cuentas del cliente', () => {
    const res = http.get(`${BANK}/customers/${data.customerId}/accounts`, {
      ...JSON_HEADERS,
      tags: { name: 'accounts' },
    });
    check(res, {
      'accounts 200': (r) => r.status === 200,
      'al menos 2 cuentas': (r) => r.json().length >= 2,
    });
  });

  group('SOAP · getAccount', () => {
    const res = http.post(SOAP, soapEnvelope('getAccount', { accountId: data.primaryAccountId }), {
      ...SOAP_HEADERS,
      tags: { name: 'soap_getAccount' },
    });
    check(res, {
      'soap 200': (r) => r.status === 200,
      'soap sin fault': (r) => !r.body.includes('Fault'),
    });
  });

  sleep(1);
}
