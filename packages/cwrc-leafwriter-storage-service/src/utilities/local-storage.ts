'use client';

/**
 * It saves a value to local storage, but if the value is not a string, it converts it to a string
 * before saving it
 * @param {string} key - string - The key to save the value under.
 * @param {unknown} value - The value to be stored in local storage.
 */
export const saveToLocalStorage = <T = unknown>(key: string, value: T) => {
  if (typeof window === 'undefined') return null;

  const stringfiedValue = typeof value === 'string' ? value : JSON.stringify({ value });
  localStorage.setItem(key, stringfiedValue);
};

/**
 * It gets a value from local storage, and if it's a JSON string, it parses it into an object
 * @param {string} key - The key to store the value under.
 * @returns The value of the key in localStorage.
 */
export const getFromLocalStorage = <T = string | Record<string, unknown>>(
  key: string,
): T | null => {
  if (typeof window === 'undefined') return null;

  const value = localStorage.getItem(key);
  if (!value) return null;

  try {
    const object = JSON.parse(value) as Record<string, unknown>;
    return object as T;
  } catch {
    return value as T;
  }
};

/**
 * It removes a key from local storage
 * @param {string} key - The key to be used to store the data in local storage.
 */
export const removeFromLocalStorage = (key: string) => {
  if (typeof window === 'undefined') return null;

  localStorage.removeItem(key);
};

/**
 * It deletes all keys from local storage
 */
export const clearLocalStorage = () => {
  if (typeof window === 'undefined') return null;

  localStorage.clear();
};
