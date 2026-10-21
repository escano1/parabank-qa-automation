# Estrategia de pruebas — ParaBank

> Documento vivo. Describe **qué** se prueba, **por qué**, **a qué nivel** y **con qué criterio de salida**.
> Sistema bajo prueba: [ParaBank](https://github.com/parasoft/parabank), banca en línea de demostración (UI web + API REST + API SOAP).

## 1. Contexto y objetivos de calidad

En un producto bancario los defectos tienen impacto directo en **dinero, confianza y cumplimiento regulatorio**. Por eso la estrategia prioriza:

1. **Integridad del dinero**: ningún flujo puede crear, perder o duplicar saldo.
2. **Seguridad y acceso**: sólo el titular accede a sus cuentas.
3. **Disponibilidad de los flujos críticos**: login, consulta de saldos, transferencias y pagos.
4. **Experiencia en el canal móvil**, donde opera la mayoría de usuarios.
5. **Rendimiento** dentro de SLO definidos para las operaciones de mayor uso.

## 2. Análisis de riesgo y priorización

Cada funcionalidad se evalúa por **impacto en el negocio × probabilidad de falla**. El resultado define la profundidad de cobertura y el tag de ejecución.

| Funcionalidad          | Impacto          | Probabilidad | Riesgo      | Cobertura                           | Tags               |
| ---------------------- | ---------------- | ------------ | ----------- | ----------------------------------- | ------------------ |
| Transferencias         | Alto (dinero)    | Alta         | **Crítico** | API + UI + reglas negativas + carga | `@critical @smoke` |
| Autorización de la API | Alto (seguridad) | Media        | **Crítico** | API (negativos)                     | `@known-bug`       |
| Login / sesión         | Alto             | Media        | Alto        | UI + API REST + SOAP                | `@critical @smoke` |
| Apertura de cuentas    | Medio            | Media        | Alto        | API + UI + concurrencia             | `@critical`        |
| Pago de servicios      | Alto (dinero)    | Media        | Alto        | UI + validaciones                   | `@critical`        |
| Préstamos              | Alto             | Baja         | Medio       | API + UI                            | `@regression`      |
| Registro de clientes   | Medio            | Media        | Medio       | UI + validaciones + i18n            | `@regression`      |
| Canal móvil            | Alto (UX)        | Media        | Alto        | Emulación Android / iOS             | `@mobile`          |

## 3. Niveles y tipos de prueba (pirámide)

```
          ▲  E2E UI (Playwright)          ~25 tests   flujos críticos de punta a punta, desktop + mobile
         ▲▲  API REST / SOAP (Playwright)  ~30 tests   reglas de negocio, contratos, negativos, seguridad
        ▲▲▲  Contrato (JSON Schema / WSDL)              en cada test de API
       ▲▲▲▲  Performance (K6)                           smoke en cada PR, carga nocturna
```

- **La mayor parte de la lógica de negocio se valida en API**: es más rápido, más estable y aísla la causa de una falla.
- **La UI valida lo que sólo la UI puede validar**: navegación, mensajes al usuario, formularios, integración front-back.
- **Los tests de UI verifican el resultado en el backend** (ej. tras transferir por UI, el saldo se consulta por API) para no depender de lo que la pantalla "dice".
- **Datos de prueba por API**: los tests crean sus cuentas con la API (`newAccount`) aunque prueben la UI. La preparación es rápida y determinista.

| Tipo                       | Herramienta                                  | Dónde                                      |
| -------------------------- | -------------------------------------------- | ------------------------------------------ |
| Funcional UI (desktop)     | Playwright + Page Object Model               | `tests/e2e`                                |
| Funcional UI (mobile web)  | Playwright con emulación Pixel 7 / iPhone 14 | proyectos `mobile-android`, `mobile-ios`   |
| API REST                   | Playwright `APIRequestContext` + AJV         | `tests/api/rest`                           |
| API SOAP                   | Playwright + `fast-xml-parser`               | `tests/api/soap`                           |
| Contrato                   | JSON Schema (AJV), WSDL                      | `src/api/schemas.ts`, `TC-SOAP-001`        |
| Consistencia entre canales | REST ↔ SOAP ↔ UI                             | `TC-SOAP-004`, `TC-SOAP-006`, `TC-ACC-002` |
| Concurrencia               | Requests paralelos                           | `TC-API-015`                               |
| Performance                | K6 (smoke, carga)                            | `performance/k6`                           |

## 4. Técnicas de diseño de casos

- **Partición de equivalencia y valores límite**: montos (negativo, cero, mayor al saldo, decimales `33.33`), campos vacíos.
- **Tablas de decisión**: aprobación de préstamos (fondos del cliente × pago inicial × cuenta origen).
- **Pruebas basadas en riesgo**: los flujos de dinero tienen escenarios negativos explícitos.
- **Pruebas exploratorias guiadas**: sesiones cortas sobre la API, de donde salieron los defectos BUG-001 a BUG-012.
- **Data-driven**: los escenarios parametrizados (tipos de cuenta, credenciales inválidas, montos inválidos) se generan desde tablas de datos en el mismo spec.

## 5. Gestión de datos de prueba

- Un **proyecto `setup`** registra un cliente nuevo por ejecución, lo fondea y guarda la sesión (`storageState`). Los tests de UI arrancan autenticados sin repetir el login.
- **Aislamiento**: cada test que valida saldos crea **sus propias cuentas**, así ningún test depende del estado que deja otro.
- Datos generados con **Faker** con usernames únicos, para poder re-ejecutar sobre un ambiente persistente.
- Los montos se comparan **en centavos (enteros)** para evitar errores de punto flotante.

## 6. Ambientes

| Ambiente                                      | Uso                 | Notas                                                                                                                                             |
| --------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Local / CI — Docker** (`parasoft/parabank`) | Ejecución principal | Aislado y determinista, sin rate limiting. Un contenedor por job de CI.                                                                           |
| **Demo público** (`parabank.parasoft.com`)    | Smoke ocasional     | Detrás de Cloudflare con rate limiting (HTTP 429/403). Los clientes API respetan `Retry-After`. **Nunca** se ejecutan pruebas de carga contra él. |

**Decisión de paralelismo**: ParaBank genera ids con un "read-then-update" no atómico (**BUG-011**), así que las escrituras concurrentes sobre la misma instancia fallan de forma aleatoria. Por eso se usa **1 worker por instancia**, y el paralelismo viene de la matriz de CI, con **un contenedor por suite**. La concurrencia se prueba de forma intencional y aislada en el proyecto `concurrency`.

## 7. Integración continua

Pipeline `.github/workflows/qa.yml`:

1. **Static checks**: ESLint (con `eslint-plugin-playwright`), `tsc --noEmit` y Prettier.
2. **Playwright** en matriz: `api` · `e2e-chromium` · `mobile-android` · `mobile-ios`. Cada job tiene su propio ParaBank como _service container_.
3. **K6**: smoke en cada push/PR, carga en la ejecución nocturna o a demanda.
4. Reportes HTML, traces, videos y JUnit como artefactos.

Disparadores: push/PR a `main`, ejecución nocturna (lun-vie) y manual.

## 8. Defectos conocidos en la suite

Los defectos confirmados se automatizan **describiendo el comportamiento correcto** y se marcan con `test.fail()` y una anotación `issue` (`BUG-xxx`):

- El pipeline se mantiene verde mientras el defecto existe y el reporte lo muestra como "expected to fail".
- Si alguien corrige el defecto, el test **pasa inesperadamente y falla el build**. Eso obliga a revisar y quitar la marca, y evita regresiones silenciosas.

Detalle en [reporte-de-defectos.md](reporte-de-defectos.md).

## 9. Criterios de entrada y salida

**Entrada a una iteración de pruebas**: historia con criterios de aceptación revisados (refinamiento con QA), ambiente desplegado y smoke en verde.

**Salida / Definition of Done de calidad**:

- 100% de los tests `@critical` y `@smoke` en verde.
- Ningún defecto abierto de severidad Crítica o Alta sin decisión explícita de negocio.
- Thresholds de K6 cumplidos (p95 y tasa de error).
- Nuevos escenarios de la historia agregados a [casos-de-prueba.md](casos-de-prueba.md) y automatizados según su riesgo.

## 10. Shift-left: participación temprana

- QA participa en el **refinamiento**: revisa criterios de aceptación, propone ejemplos concretos (estilo BDD _Given/When/Then_) y escenarios negativos antes de que exista código.
- **Tres amigos** (PO, Dev, QA) en historias de riesgo alto (dinero, seguridad).
- Revisión de contratos de API (OpenAPI/WSDL) antes de la implementación: los schemas de `src/api/schemas.ts` sirven como contrato ejecutable.
- Los tests de API corren en cada PR y dan feedback en minutos.

## 11. Métricas

- Tasa de éxito por suite y **flaky rate** (tests que pasan en un reintento; el trace del primer reintento queda guardado).
- Defectos por severidad y por fase de detección (refinamiento / PR / regresión / producción).
- Tiempo de ejecución del pipeline.
- Tendencia de p95 y tasa de error en K6.

## 12. Alcance para la app nativa (siguiente paso)

Este repositorio cubre **mobile web**, con emulación de dispositivo en Playwright. Para una **app nativa** (iOS/Android) la estrategia se extiende así:

- **Appium** (WebdriverIO) o **Maestro** para E2E nativo, reusando la capa de API y datos de este framework para preparar estados.
- **Detox / Espresso / XCUITest** para pruebas de componentes del equipo de desarrollo.
- Granja de dispositivos reales (BrowserStack / Sauce Labs) con una matriz basada en analítica de uso: versiones de SO, fabricantes y tamaños de pantalla.
- Pruebas específicas de mobile: permisos, interrupciones (llamadas, notificaciones), modo avión / red lenta, deep links, biometría, actualización de versión con datos existentes, accesibilidad (VoiceOver / TalkBack).
