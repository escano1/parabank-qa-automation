# ParaBank · QA Automation Framework

[![QA Pipeline](https://github.com/OWNER/REPO/actions/workflows/qa.yml/badge.svg)](https://github.com/OWNER/REPO/actions/workflows/qa.yml)
![Playwright](https://img.shields.io/badge/Playwright-1.64-2EAD33?logo=playwright&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![k6](https://img.shields.io/badge/k6-performance-7D64FF?logo=k6&logoColor=white)

Framework de automatización de pruebas sobre **ParaBank**, una aplicación bancaria de demostración, que cubre las capas de calidad de un producto financiero:

| Capa            | Qué se valida                                                  | Herramienta                             |
| --------------- | -------------------------------------------------------------- | --------------------------------------- |
| **UI E2E**      | Registro, login, cuentas, transferencias, pagos, préstamos     | Playwright + Page Object Model          |
| **Mobile web**  | Flujos críticos en Pixel 7 (Android) e iPhone 14 (iOS/WebKit)  | Emulación de dispositivos de Playwright |
| **API REST**    | Reglas de negocio, contratos JSON Schema, negativos, seguridad | Playwright `APIRequestContext` + AJV    |
| **API SOAP**    | Operaciones del WSDL, faults, consistencia SOAP ↔ REST         | Playwright + `fast-xml-parser`          |
| **Performance** | Smoke y carga mixta lectura/escritura con SLO                  | K6                                      |
| **CI/CD**       | Lint, typecheck, suites en paralelo por job, reportes          | GitHub Actions + Docker                 |

> 📄 **Documentación de QA**
>
> - [Estrategia de pruebas](docs/estrategia-de-pruebas.md): riesgo, pirámide, datos, ambientes, criterios de salida, shift-left, extensión a app nativa.
> - [Casos y escenarios](docs/casos-de-prueba.md): Gherkin + matriz de trazabilidad (cada ID aparece en el título del test).
> - [Reporte de defectos](docs/reporte-de-defectos.md): **12 defectos reales** encontrados, con pasos, impacto y causa raíz.

## Hallazgos destacados

La automatización encontró defectos reales, cada uno reproducido por un test:

- 🔴 **La API REST no exige autenticación**: cualquiera puede consultar saldos y mover dinero de cuentas ajenas (BOLA/IDOR).
- 🔴 **Transferencias con montos negativos y sin fondos** son aceptadas.
- 🔴 **Condición de carrera en la generación de ids**: con requests concurrentes fallan aperturas de cuenta y registros. La causa raíz está identificada en el código fuente (`JdbcSequenceDao`).
- 🟠 **El registro falla con tildes y eñes** ("José Núñez" → HTTP 400): crítico para clientes de Latinoamérica. Además, un campo más largo que su columna se reporta como "username ya existe".

Los defectos se automatizan con `test.fail()` describiendo el comportamiento **correcto**: el pipeline sigue verde y, si alguien corrige el defecto, el test falla para obligar a actualizar la suite.

## Arquitectura

```
├── .github/workflows/qa.yml     Pipeline: static checks → Playwright (matriz) + K6
├── docker-compose.yml           ParaBank local (mismo contenedor que usa CI)
├── playwright.config.ts         Proyectos: setup · api · e2e-chromium · mobile-android · mobile-ios · concurrency
├── src/
│   ├── api/                     Clientes REST y SOAP, schemas (contratos), retry ante 429
│   ├── data/                    Factory de clientes (Faker), cliente de prueba compartido
│   ├── fixtures/                Fixtures de Playwright: page objects, clientes API, `newAccount`
│   ├── pages/                   Page Objects
│   └── utils/                   Dinero en centavos (sin errores de punto flotante)
├── tests/
│   ├── setup/                   Registra y fondea el cliente; guarda la sesión (storageState)
│   ├── api/rest | api/soap      Pruebas de API
│   └── e2e/                     Pruebas de UI (los tags @mobile también corren en Android/iOS)
├── performance/k6/              smoke.js · load.js
└── docs/                        Estrategia, casos de prueba, defectos
```

**Decisiones de diseño**

- **Fixtures en lugar de herencia**: cada test declara lo que necesita (`{ transferPage, rest, newAccount }`) y Playwright lo construye y libera.
- **Datos por API y validación en backend**: los tests de UI preparan sus cuentas por API (rápido y determinista) y verifican el resultado consultando el backend, no sólo la pantalla.
- **Aislamiento**: cada test que valida saldos opera sobre cuentas propias recién creadas.
- **Contratos ejecutables**: las respuestas REST se validan con JSON Schema; un campo faltante o un tipo distinto falla el test aunque el status sea 200.
- **Un worker por instancia de ParaBank** por BUG-011. El paralelismo se logra en CI con un job y un contenedor por suite.

## Cómo ejecutar

**Requisitos**: Node.js 20+, Docker (o cualquier runtime compatible) y opcionalmente [k6](https://grafana.com/docs/k6/latest/set-up/install-k6/).

```bash
npm ci
npx playwright install chromium webkit

# Levantar ParaBank local en http://localhost:8080/parabank/
docker compose up -d

npm test                 # toda la suite
npm run test:api         # API REST + SOAP
npm run test:e2e         # UI desktop (Chromium)
npm run test:mobile      # UI mobile (Android + iOS)
npm run test:smoke       # sólo @smoke
npm run test:critical    # sólo @critical
npm run report           # abrir el último reporte HTML

npm run perf:smoke       # K6 smoke (1 VU, 30s)
npm run perf:load        # K6 carga (~2 min)
```

Filtros útiles:

```bash
npx playwright test --grep "TC-TRF-001"      # un caso por ID
npx playwright test --grep @known-bug        # sólo los defectos conocidos
npx playwright test --grep-invert @known-bug # sin los defectos conocidos
npx playwright test --ui                     # modo interactivo
```

**Contra el demo público**: crear un `.env` con `BASE_URL=https://parabank.parasoft.com/parabank/`. Ese ambiente tiene rate limiting de Cloudflare. Los clientes API respetan `Retry-After`, pero se recomienda usarlo sólo para un smoke. Los scripts de K6 se niegan a correr contra él.

## Pipeline de CI

`static-checks` (ESLint con `eslint-plugin-playwright`, `tsc`, Prettier) → en paralelo:

- **Playwright** en matriz `api` · `e2e-chromium` · `mobile-android` · `mobile-ios`, cada job con su propio ParaBank como _service container_.
- **K6**: smoke en cada push/PR; prueba de carga en la ejecución nocturna o manual (`workflow_dispatch`).

Cada job publica su reporte HTML, traces, screenshots, videos y JUnit como artefactos.

## Resultados de referencia

Ejecución local contra ParaBank 6.0.0-SNAPSHOT:

| Suite                                  | Resultado                                                                        |
| -------------------------------------- | -------------------------------------------------------------------------------- |
| Playwright (todos los proyectos)       | 67 tests ✅ (incluye 15 defectos conocidos documentados) · ~1.9 min con 1 worker |
| K6 smoke                               | 100% checks · p95 7.6 ms · 0% errores                                            |
| K6 carga (16 VUs + 4 transferencias/s) | 100% checks · p95 transferencia 7.5 ms · 0% errores                              |
