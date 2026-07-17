import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores([
    'dist',
    'coverage',
    '.next',
    'src/services/mlService.ts',
    'src/features/charts/CorrelationHeatmap.tsx',
    'src/features/charts/OrderFlowSankey.tsx',
    'src/features/charts/VolatilitySurface3D.tsx',
    'src/features/charts/VolatilitySurface.tsx',
  ]),
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    files: ['scripts/**/*.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ['src/services/**/*.ts'],
    rules: {
      // Active services still contain legacy suppression comments. Keep the
      // files linted while surfacing those comments as migration warnings.
      '@typescript-eslint/ban-ts-comment': 'warn',
    },
  },
])
