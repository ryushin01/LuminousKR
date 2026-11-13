// @ts-check
import js from '@eslint/js'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import solid from 'eslint-plugin-solid/configs/typescript'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      'dist',
      'storybook-static',
      'coverage',
      'playwright-report',
      'test-results',
      'lhci-report',
      '.lighthouseci',
      'public',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    ...solid,
  },
  {
    files: ['**/*.tsx'],
    ...jsxA11y.flatConfigs.strict,
    rules: {
      ...jsxA11y.flatConfigs.strict.rules,
      // APG 탭 패널(tabpanel)과 가로 스크롤 영역(region)은 키보드로 닿도록 tabindex="0"을 둡니다.
      'jsx-a11y/no-noninteractive-tabindex': ['error', { tags: [], roles: ['tabpanel', 'region'] }],
      // 체크박스 레이블처럼 글자가 label > span > strong 안에 있는 경우까지 찾습니다.
      'jsx-a11y/label-has-associated-control': ['error', { depth: 3 }],
    },
  },
  {
    languageOptions: {
      globals: { ...globals.browser },
    },
    settings: {
      // Solid는 htmlFor 대신 for를 씁니다. 레이블 연결 검사가 for를 알아보게 합니다.
      'jsx-a11y': { attributes: { for: ['for'] } },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['scripts/**', 'e2e/**', '*.config.{js,ts}', '.storybook/**'],
    languageOptions: { globals: { ...globals.node } },
  },
)
