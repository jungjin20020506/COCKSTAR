import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: { ...globals.browser, __APP_VERSION__: 'readonly' },
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^[A-Z_]' }],
      // 컨텍스트·유틸 파일은 훅/함수와 컴포넌트를 함께 내보내는 게 목적이다.
      // (constantExport 만 허용하는 기본값은 이 구조와 맞지 않는다)
      'react-refresh/only-export-components': ['warn', { allowExportNames: [
        'useAuth', 'useRooms', 'useConfirm', 'useInstallState',
        'toast', 'isStandalone', 'isIOS', 'countVisit', 'checkJoinable',
      ] }],
    },
  },
])
