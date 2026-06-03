import type { Config } from 'jest';
import baseConfig from './jest.base.config.ts';

const config: Config = {
  ...baseConfig,

  testMatch: [
    '**/__tests__/e2e/**/*.test.ts',
  ],

  testTimeout: 30000,

  collectCoverage: false,
};

export default config;