import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/.terraform/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['infrastructure/terraform/environment/spa.js'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { varsIgnorePattern: '^handler$' },
      ],
    },
  },
  {
    files: ['load-tests/*.js'],
    languageOptions: { sourceType: 'module', globals: { __ENV: 'readonly' } },
  },
  {
    files: ['**/*.{ts,tsx,mjs}'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
);
