import type { Config } from '@jest/types';

const dexieModulePath = '<rootDir>/node_modules/dexie/dist/dexie.js';

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
      moduleNameMapper: { '^dexie$': dexieModulePath },
      resetMocks: false,
      setupFiles: [
        'fake-indexeddb/auto',
        '<rootDir>/packages/cwrc-leafwriter-validator/test/setup/index.ts',
      ],
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/packages/cwrc-leafwriter-validator/**/?(*.)+(spec|test).[jt]s?(x)'],
      testPathIgnorePatterns: ['<rootDir>/packages/cwrc-leafwriter-validator/lib*'],
      preset: 'ts-jest',
    },
    {
      displayName: { name: 'Storage Dialog', color: 'cyanBright' },
      clearMocks: true,
      coveragePathIgnorePatterns: ['/node_modules/', '/dist', '/lib', 'lib-esm', '/test'],
      moduleNameMapper: {
        '^@cwrc/leafwriter-storage-service$':
          '<rootDir>/packages/cwrc-leafwriter-storage-service/src/index.tsx',
        '^@cwrc/leafwriter-storage-service/(.*)$':
          '<rootDir>/packages/cwrc-leafwriter-storage-service/src/$1',
        '^@octokit/rest$': '<rootDir>/packages/cwrc-leafwriter-storage-service/test/mocks/octokit.ts',
        '^dexie$': dexieModulePath,
        '^nanoid$': '<rootDir>/packages/cwrc-leafwriter-storage-service/test/mocks/nanoid.ts',
      },
      resetMocks: false,
      setupFiles: ['fake-indexeddb/auto'],
      setupFilesAfterEnv: [
        '<rootDir>/packages/cwrc-leafwriter-storage-service/test/setup/afterEnv.ts',
      ],
      testEnvironment: 'jsdom',
      testMatch: [
        '<rootDir>/packages/cwrc-leafwriter-storage-service/**/?(*.)+(spec|test).[jt]s?(x)',
      ],
      testPathIgnorePatterns: ['<rootDir>/packages/cwrc-leafwriter-storage-service/lib*'],
      moduleFileExtensions: ['ts', 'tsx', 'js', 'mjs', 'cjs', 'jsx', 'json', 'node'],
      preset: 'ts-jest',
    },
    {
      displayName: { name: 'Core', color: 'blue' },
      clearMocks: true,
      coveragePathIgnorePatterns: ['/node_modules/', '/dist', '/lib', 'lib-esm', '/test'],
      moduleNameMapper: { '^dexie$': dexieModulePath },
      resetMocks: false,
      setupFiles: [
        '<rootDir>/packages/cwrc-leafwriter/test/setup/structuredClone.ts',
        'fake-indexeddb/auto',
      ],
      setupFilesAfterEnv: ['<rootDir>/packages/cwrc-leafwriter/test/setup/jestAfterEnv.ts'],
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/packages/cwrc-leafwriter/**/?(*.)+(spec|test).[jt]s?(x)'],
      testPathIgnorePatterns: ['<rootDir>/packages/cwrc-leafwriter/lib*'],
      preset: 'ts-jest',
      transform: {
        '\\.txt$': '<rootDir>/packages/cwrc-leafwriter/test/loadTextFile.cjs',
      },
    },
    {
      displayName: { name: 'desktop', color: 'green' },
      clearMocks: true,
      coveragePathIgnorePatterns: ['/node_modules/', '/dist', '/lib', 'lib-esm'],
      resetMocks: false,
      testEnvironment: 'node',
      testMatch: ['<rootDir>/apps/desktop/**/?(*.)+(spec|test).[jt]s?(x)'],
      preset: 'ts-jest',
    },
    {
      displayName: { name: 'commons', color: 'red' },
      clearMocks: true,
      coveragePathIgnorePatterns: ['/node_modules/', '/dist', '/lib', 'lib-esm', '/test'],
      moduleNameMapper: {
        '^@src/(.*)$': '<rootDir>/apps/commons/src/$1',
        '^dexie$': dexieModulePath,
      },
      resetMocks: false,
      setupFiles: [
        'fake-indexeddb/auto',
        '<rootDir>/apps/commons/test/setup/index.ts',
      ],
      setupFilesAfterEnv: ['<rootDir>/packages/cwrc-leafwriter/test/setup/jestAfterEnv.ts'],
      testEnvironment:
        '<rootDir>/packages/cwrc-leafwriter-validator/test/setup/FixJSDOMEnvironment.ts',
      testMatch: ['<rootDir>/apps/commons/**/?(*.)+(spec|test).[jt]s?(x)'],
      preset: 'ts-jest',
    },
  ],
};

export default config;
