import type { Config } from 'jest';

const config: Config = {
  testEnvironment: 'node',

  clearMocks: true,

  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: './tsconfig.jest.json' }],
  },

  moduleFileExtensions: ['ts', 'js', 'json'],

  testMatch: [
    '**/__tests__/e2e/**/*.test.ts',
  ],

  testTimeout: 120000,

  maxWorkers: 1,

  collectCoverage: false,
};

export default config;