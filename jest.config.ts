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
      testMatch: ['<rootDir>/packages/validator/**/?(*.)+(spec|test).[jt]s?(x)'],
      testPathIgnorePatterns:['<rootDir>/packages/validator/lib*'],
    },
    {
      displayName: { name: 'Storage Dialog', color: 'cyanBright'},
      clearMocks: true,
      coveragePathIgnorePatterns: ['/node_modules/', '/dist', '/lib', 'lib-esm', '/test'],
      resetMocks: false,
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/packages/storageService/**/?(*.)+(spec|test).[jt]s?(x)'],
      testPathIgnorePatterns:['<rootDir>/packages/storageService/lib*'],
    },
    {
      displayName: { name: 'Core', color: 'blue'},
      clearMocks: true,
      coveragePathIgnorePatterns: ['/node_modules/', '/dist', '/lib', 'lib-esm', '/test'],
      resetMocks: false,
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/packages/core/**/?(*.)+(spec|test).[jt]s?(x)'],
      testPathIgnorePatterns:['<rootDir>/packages/core/lib*'],
    },
    {
      displayName: { name: 'commons', color: 'red'},
      clearMocks: true,
      coveragePathIgnorePatterns: ['/node_modules/', '/dist', '/lib', 'lib-esm', '/test'],
      resetMocks: false,
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/packages/commons/**/?(*.)+(spec|test).[jt]s?(x)'],
    },
  ],
};


export default config;