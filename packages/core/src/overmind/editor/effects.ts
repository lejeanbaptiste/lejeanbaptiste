import { ILookups } from '../../components/entityLookups/types';

export const api = (() => {
  let lookupsDefaults: ILookups | undefined;

  return {
    getLookupsDefaults: () => {
      return lookupsDefaults;
    },
    setLookupsDefaults: (value: ILookups) => {
      lookupsDefaults = value;
    },
    saveToLocalStorage: (key: string, value: string) => {
      localStorage.setItem(key, value);
    },
    getFromLocalStorage: (key: string) => {
      return localStorage.getItem(key);
    },
    removeFromLocalStorage: (key: string) => {
      localStorage.removeItem(key);
    },
  };
})();
