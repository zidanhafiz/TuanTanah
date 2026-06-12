import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import prettier from 'eslint-config-prettier'
import globals from 'globals'

export default tseslint.config(
  // Ignore generated / vendored output (mirrors .prettierignore + .gitignore).
  {
    ignores: ['**/dist/**', '**/build/**', '**/node_modules/**', '**/*.tsbuildinfo'],
  },

  // Base JS + TypeScript rules for every source file.
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Server + shared run on Node.
  {
    files: ['server/**/*.ts', 'shared/**/*.ts'],
    languageOptions: { globals: { ...globals.node } },
  },

  // Client runs in the browser and uses React.
  {
    files: ['client/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs['recommended-latest'].rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // Newer, opinionated perf rules — surface as warnings, not gate failures,
      // so they don't block on pre-existing code. Promote to 'error' after cleanup.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },

  // Project-wide rule tweaks. Allow `_`-prefixed throwaways to match the
  // strict-tsc `noUnusedLocals`/`noUnusedParameters` convention.
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },

  // Must come last: turns off rules that conflict with Prettier formatting.
  prettier,
)
