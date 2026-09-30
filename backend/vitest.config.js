import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        include: ['tests/**/*.test.js'],
        setupFiles: ['tests/setupEnv.js'],
        // Os testes HTTP partilham o estado em memória do rate limiter.
        fileParallelism: false,
    },
});
