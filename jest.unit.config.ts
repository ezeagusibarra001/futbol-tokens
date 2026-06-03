import type { Config } from 'jest';

const config: Config = {
  testEnvironment: 'node',

  clearMocks: true,

  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: './tsconfig.jest.json' }],
  },

  moduleFileExtensions: ['ts', 'js', 'json'],

  testMatch: [
    '**/__tests__/unit/**/*.test.ts',
  ],

  collectCoverage: true,

  coverageDirectory: 'coverage/unit',

  collectCoverageFrom: [
    'src/**/*.ts',

    '!src/**/*.d.ts',
    '!src/**/*.test.ts',

    // bootstrap
    '!src/app.ts',
    '!src/index.ts',

    // infra
    '!src/config/db.ts',
    '!src/config/seed.ts',
    '!src/config/scheduler.ts',

    // docs
    '!src/docs/**',

    // express wiring
    '!src/**/routes.ts',
    '!src/**/*.routes.ts',

    // healthcheck
    '!src/modules/root/**',

    // scripts
    '!src/scripts/**',

    // scraper
    '!src/modules/player/player.scrapper.ts',

    // test helpers (including shared src/modules/__tests__/helpers.ts)
    '!src/**/__tests__/**',
  ],
};

export default config;