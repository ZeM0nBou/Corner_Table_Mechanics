import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules'] },

  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.strict],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },

  // Composants React
  {
    files: ['src/**/*.tsx'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },

  // Règle absolue (CLAUDE.md) : core/ ne connaît pas l'UI.
  {
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'react', message: 'core/ doit rester du TypeScript pur, sans React.' },
            { name: 'react-dom', message: 'core/ doit rester du TypeScript pur, sans React.' },
          ],
          patterns: [
            {
              group: ['react/*', 'react-dom/*', '@ui/*', '**/ui/*', '**/ui'],
              message: 'core/ ne doit pas dépendre de l’UI.',
            },
          ],
        },
      ],
    },
  },

  // Fichiers de config exécutés par Node
  {
    files: ['*.config.{js,ts}'],
    languageOptions: { globals: globals.node },
  },

  // Désactive les règles de style qui entrent en conflit avec Prettier (doit rester en dernier)
  prettier,
);
