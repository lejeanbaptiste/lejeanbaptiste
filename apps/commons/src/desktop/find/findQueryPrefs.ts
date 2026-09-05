export const FIND_QUERY_STORAGE_KEY = 'grognard:findQuery';

export const readStoredFindQuery = (): string => {
  try {
    return localStorage.getItem(FIND_QUERY_STORAGE_KEY) ?? '';
  } catch {
    // Ignore storage access errors (private mode, etc.).
    return '';
  }
};

export const writeStoredFindQuery = (query: string) => {
  try {
    localStorage.setItem(FIND_QUERY_STORAGE_KEY, query);
  } catch {
    // Ignore storage access errors.
  }
};
