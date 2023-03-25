import type { LookupsProps } from '../../dialogs/entityLookups';

export const api = (() => {
  let lookupsDefaults: LookupsProps | undefined;

  return {
    getLookupsDefaults: () => {
      return lookupsDefaults;
    },
    setLookupsDefaults: (value: LookupsProps) => {
      lookupsDefaults = value;
    },
    saveToLocalStorage: (key: string, value: unknown) => {
      localStorage.setItem(key, JSON.stringify(value));
    },
    getFromLocalStorage: (key: string) => {
      const value = localStorage.getItem(key);
      if (!value) return;

      try {
        const object = JSON.parse(value);
        return object;
      } catch (error) {
        return value;
      }
    },
    removeFromLocalStorage: (key: string) => {
      localStorage.removeItem(key);
    },
  };
})();
