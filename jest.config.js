/* eslint-disable @typescript-eslint/no-require-imports */
const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
})

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: [
    '**/__tests__/**/*.[jt]s?(x)',
    '**/?(*.)+(spec|test).[jt]s?(x)',
  ],
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/.next/',
    '<rootDir>/mobile/',
    // Integration suites excluded from the deterministic gate (ADR-054): they hit
    // the live DB and require seeded user/notification/audit rows, so they are not
    // reproducible in a fast gate. Run explicitly with `npm run test:integration`.
    '<rootDir>/tests/auth/audit.test.ts',
    '<rootDir>/tests/auth/notifications.test.ts',
    '<rootDir>/tests/auth/profile.test.ts',
    '<rootDir>/tests/auth/phone-otp.test.ts',
  ],
  modulePathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/mobile/',
  ],
  coveragePathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/mobile/',
  ],
  collectCoverageFrom: [
    'src/lib/utils.ts',
    'src/lib/scraping/product-filter.ts',
  ],
  coverageThreshold: {
    global: {
      statements: 70,
      branches: 70,
      functions: 70,
      lines: 70,
    },
  },
  testTimeout: 10000, // 10 seconds for database tests
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig)
