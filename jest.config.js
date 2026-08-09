/**
 * Jest config.
 *
 * Scoped to src/ so the pure tracking logic can be tested on Windows with no
 * device. `jest-expo` handles the React Native transform chain; it is only
 * actually needed once component tests exist, but configuring it now means
 * adding those later doesn't require touching this file.
 */
module.exports = {
  preset: 'jest-expo',
  testMatch: ['<rootDir>/src/**/*.test.ts', '<rootDir>/src/**/*.test.tsx'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.test.ts'],
};
