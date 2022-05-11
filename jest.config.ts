import type {Config} from '@jest/types';

const config: Config.InitialOptions = {
  // collectCoverage: true,
  coverageProvider: 'v8',
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 50,
      lines: 65,
      statements: 65,
    },
  },
  // verbose: true,
  projects: [
    {
      displayName: { name: 'Validator', color: 'magenta'},
      automock: false,
      clearMocks: true,
      coveragePathIgnorePatterns: ['/node_modules/', '/dist', '**/lib/*', '**/lib-esm/*', '/test'],
      resetMocks: false,
      setupFiles: ['<rootDir>/packages/validator/test/setup/index.ts'],
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/packages/validator/test/**/?(*.)+(spec|test).[jt]s?(x)'],
    },
    {
      displayName: { name: 'Storage Dialog', color: 'cyanBright'},
      clearMocks: true,
      coveragePathIgnorePatterns: ['/node_modules/', '/dist', '/lib', 'lib-esm', '/test'],
      resetMocks: false,
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/packages/storageService/test/**/?(*.)+(spec|test).[jt]s?(x)'],
    },
    {
      displayName: { name: 'Core', color: 'blue'},
      clearMocks: true,
      coveragePathIgnorePatterns: ['/node_modules/', '/dist', '/lib', 'lib-esm', '/test'],
      resetMocks: false,
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/packages/core/test/**/?(*.)+(spec|test).[jt]s?(x)'],
    },
    {
      displayName: { name: 'Standalone', color: 'red'},
      clearMocks: true,
      coveragePathIgnorePatterns: ['/node_modules/', '/dist', '/lib', 'lib-esm', '/test'],
      resetMocks: false,
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/packages/standalone/test/**/?(*.)+(spec|test).[jt]s?(x)'],
    },
  ],
};


export default config;