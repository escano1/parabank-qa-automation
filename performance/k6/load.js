import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend } from 'k6/metrics';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.1.0/index.js';
import {
  BANK,
  JSON_HEADERS,
  SOAP,
  SOAP_HEADERS,
  guardAgainstPublicDemo,
  setupCustomer,
  soapEnvelope,
} from './lib/parabank.js';

const transferDuration = new Trend('transfer_duration', true);

/**
 * Carga: simula clientes consultando saldos (lectura, ~80%) y transfiriendo entre cuentas (escritura, ~20%),
 * que es la mezcla típica de una app bancaria. Los SLO se definen por operación con thresholds etiquetados.
 */
export const options = {
  scenarios: {
    consultas: {
      executor: 'ramping-vus',
      exec: 'consultas',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 16 },
        { duration: '1m', target: 16 },
        { duration: '20s', target: 0 },
      ],
    },
    transferencias: {
      executor: 'constant-arrival-rate',
      exec: 'transferencias',
      rate: 4,
      timeUnit: '1s',
      duration: '1m50s',
      preAllocatedVUs: 4,
      maxVUs: 10,
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{name:accounts}': ['p(95)<800'],
    'http_req_duration{name:account}': ['p(95)<800'],
    'http_req_duration{name:soap_getAccount}': ['p(95)<1000'],
    transfer_duration: ['p(95)<1500', 'p(99)<2500'],
    checks: ['rate>0.99'],
  },
};

export function setup() {
  guardAgainstPublicDemo();
  return setupCustomer();
}

export function consultas(data) {
  group('consultar saldos', () => {
    const accounts = http.get(`${BANK}/customers/${data.customerId}/accounts`, {
      ...JSON_HEADERS,
      tags: { name: 'accounts' },
    });
    check(accounts, { 'accounts 200': (r) => r.status === 200 });

    const account = http.get(`${BANK}/accounts/${data.primaryAccountId}`, {
      ...JSON_HEADERS,
      tags: { name: 'account' },
    });
    check(account, { 'account 200': (r) => r.status === 200 });

    const soap = http.post(SOAP, soapEnvelope('getAccount', { accountId: data.savingsAccountId }), {
      ...SOAP_HEADERS,
      tags: { name: 'soap_getAccount' },
    });
    check(soap, { 'soap 200': (r) => r.status === 200 });
  });
  sleep(Math.random() * 2 + 1); // think time 1-3s
}

export function transferencias(data) {
  const res = http.post(
    `${BANK}/transfer?fromAccountId=${data.primaryAccountId}&toAccountId=${data.savingsAccountId}&amount=1`,
    null,
    { ...JSON_HEADERS, tags: { name: 'transfer' } },
  );
  transferDuration.add(res.timings.duration);
  check(res, { 'transfer 200': (r) => r.status === 200 && r.body.startsWith('Successfully transferred') });
}

export function handleSummary(data) {
  return {
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
    'performance/k6/results/load-summary.json': JSON.stringify(data, null, 2),
  };
}
