import type { Config } from 'jest';

const baseConfig: Config = {
  testEnvironment: 'node',
  clearMocks: true,
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: './tsconfig.jest.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
};

export default baseConfig;