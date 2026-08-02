import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'storybook-static', 'coverage', 'tests/fixtures']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  // Context modules intentionally export a provider component alongside the hooks
  // that read it — splitting them would scatter a single concern across two files
  // for no benefit other than silencing this rule.
  {
    files: ['src/**/context/**/*.jsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  // Tests and stories are not part of the Fast Refresh graph and may export helpers.
  {
    files: ['**/*.{test,spec}.{js,jsx}', '**/*.stories.{js,jsx}', 'vitest.setup.js'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  // Build/tooling scripts run under Bun/Node, not the browser.
  {
    files: ['scripts/**/*.{js,mjs}', '*.config.js', '.storybook/**/*.{js,jsx}'],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
