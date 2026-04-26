import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    swc.vite({
      jsc: {
        parser: { syntax: 'typescript', decorators: true },
        transform: { decoratorMetadata: true, legacyDecorator: true },
        target: 'es2022',
      },
    }),
  ],
  oxc: false,
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.unit.spec.ts'],
    setupFiles: ['./test-setup/vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: [
        'src/article/article.service.ts',
        'src/auth/auth.service.ts',
        'src/category/category.service.ts',
        'src/comment/comment.service.ts',
        'src/user/user.service.ts',
        'src/common/decorators/**/*.ts',
        'src/common/dto/**/*.ts',
        'src/common/errors/**/*.ts',
        'src/common/filters/**/*.ts',
        'src/common/guards/**/*.ts',
        'src/common/interceptors/**/*.ts',
        'src/common/logger/redact.ts',
        'src/common/logger/file-rotator.ts',
        'src/common/pipes/**/*.ts',
        'src/common/utils/**/*.ts',
        'src/article/dto/**/*.ts',
        'src/auth/dto/**/*.ts',
        'src/category/dto/**/*.ts',
        'src/comment/dto/**/*.ts',
        'src/user/dto/**/*.ts',
      ],
      exclude: [
        '**/*.spec.ts',
        '**/index.ts',
        'src/**/*.module.ts',
        'src/**/interfaces/**',
        'src/**/enums/**',
      ],
      thresholds: {
        lines: 90,
        branches: 85,
        functions: 85,
        statements: 90,
      },
    },
  },
});
