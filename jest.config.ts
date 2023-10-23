import type { Config } from '@jest/types';

const config: Config.InitialOptions = {
  // collectCoverage: true,
  // coverageProvider: 'v8',
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 55,
      lines: 70,
      statements: 70,
    },
  },
  workerThreads: true,
  // verbose: true,
  projects: [
    {
      displayName: { name: 'Validator', color: 'magenta' },
      automock: false,
      clearMocks: true,
      coveragePathIgnorePatterns: ['/node_modules/', '/dist', '/docs', '/lib', '/lib-esm', '/test'],
      moduleNameMapper: { '^dexie$': require.resolve('dexie') },
      resetMocks: false,
      setupFiles: ['fake-indexeddb/auto', '<rootDir>/packages/validator/test/setup/index.ts'],
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/packages/validator/**/?(*.)+(spec|test).[jt]s?(x)'],
      testPathIgnorePatterns: ['<rootDir>/packages/validator/lib*'],
      preset: 'ts-jest',
    },
    {
      displayName: { name: 'Storage Dialog', color: 'cyanBright' },
      clearMocks: true,
      coveragePathIgnorePatterns: ['/node_modules/', '/dist', '/lib', 'lib-esm', '/test'],
      moduleNameMapper: { '^dexie$': require.resolve('dexie') },
      resetMocks: false,
      setupFiles: ['fake-indexeddb/auto'],
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/packages/storageService/**/?(*.)+(spec|test).[jt]s?(x)'],
      testPathIgnorePatterns: ['<rootDir>/packages/storageService/lib*'],
      moduleFileExtensions: ['ts', 'tsx', 'js', 'mjs', 'cjs', 'jsx', 'json', 'node'],
      preset: 'ts-jest',
    },
    {
      displayName: { name: 'Core', color: 'blue' },
      clearMocks: true,
      coveragePathIgnorePatterns: ['/node_modules/', '/dist', '/lib', 'lib-esm', '/test'],
      moduleNameMapper: { '^dexie$': require.resolve('dexie') },
      resetMocks: false,
      setupFiles: ['fake-indexeddb/auto'],
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/packages/core/**/?(*.)+(spec|test).[jt]s?(x)'],
      testPathIgnorePatterns: ['<rootDir>/packages/core/lib*'],
      preset: 'ts-jest',
    },
    {
      displayName: { name: 'commons', color: 'red' },
      clearMocks: true,
      coveragePathIgnorePatterns: ['/node_modules/', '/dist', '/lib', 'lib-esm', '/test'],
      moduleNameMapper: { '^dexie$': require.resolve('dexie') },
      resetMocks: false,
      setupFiles: ['fake-indexeddb/auto'],
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/packages/commons/**/?(*.)+(spec|test).[jt]s?(x)'],
      preset: 'ts-jest',
    },
  ],
};

export default config;
