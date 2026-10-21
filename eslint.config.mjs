import tseslint from 'typescript-eslint';
import playwright from 'eslint-plugin-playwright';

export default tseslint.config(
  { ignores: ['node_modules', 'playwright-report', 'test-results', '.auth', 'performance/**'] },
  ...tseslint.configs.recommended,
  {
    files: ['tests/**/*.ts'],
    ...playwright.configs['flat/recommended'],
    rules: {
      ...playwright.configs['flat/recommended'].rules,
      // Las aserciones viven en los page objects / helpers en algunos casos.
      'playwright/expect-expect': ['warn', { assertFunctionNames: ['expectSchema', 'expect*'] }],
      'playwright/missing-playwright-await': 'error',
    },
  },
);
