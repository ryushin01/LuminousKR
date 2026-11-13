import fsd from '@feature-sliced/steiger-plugin'
import { defineConfig } from 'steiger'

export default defineConfig([
  ...fsd.configs.recommended,
  {
    // 테스트와 스토리는 슬라이스 공개 API 검사에서 뺌
    ignores: ['**/*.test.ts', '**/*.test.tsx', '**/*.stories.tsx'],
  },
])
