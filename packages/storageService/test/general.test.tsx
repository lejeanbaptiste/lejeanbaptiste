import { describe, expect, test } from '@jest/globals';
import '@testing-library/jest-dom';
import { log, logEnabledFor } from '../src/utilities/log';

describe('General', () => {
  test('log production', async () => {
    expect.assertions(2);

    log.setLevel('SILENT');
    expect(logEnabledFor('INFO')).toBeFalsy();

    log.setLevel('TRACE');
    expect(logEnabledFor('INFO')).toBeTruthy();
  });
});
