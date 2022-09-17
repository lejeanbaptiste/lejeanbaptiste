import type { ILookups } from '../../dialogs/entityLookups/types';

export const api = (() => {
  let lookupsDefaults: ILookups | undefined;

  return {
    getLookupsDefaults: () => {
      return lookupsDefaults;
    },
    setLookupsDefaults: (value: ILookups) => {
      lookupsDefaults = value;
    },
    saveToLocalStorage: (key: string, value: unknown) => {
      localStorage.setItem(key, JSON.stringify(value));
    },
    getFromLocalStorage: (key: string) => {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : null;
    },
    removeFromLocalStorage: (key: string) => {
      localStorage.removeItem(key);
    },
  };
})();
