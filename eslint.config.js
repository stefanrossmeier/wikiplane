import js from '@eslint/js';
import tseslint from 'typescript-eslint';

const nodeGlobals = {
  Buffer: 'readonly',
  URL: 'readonly',
  fetch: 'readonly',
  process: 'readonly',
  console: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
};

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', 'services/**', 'third_party/**', 'evals/reports/**'] },
  {
    ...js.configs.recommended,
    languageOptions: { globals: nodeGlobals },
  },
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: { parserOptions: { projectService: true }, globals: nodeGlobals },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
);
