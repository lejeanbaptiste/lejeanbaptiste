import axios from 'axios';

export const api = {
  async loadCollection(collection: string) {
    const { data } = await axios.get<ISample[]>(`./content/${collection}.json`);
    return data;
  },
  },
  saveToLocalStorage<T = unknown>(key: string, value: T) {
    const stringfiedValue = typeof value === 'string' ? value : JSON.stringify(value);
    localStorage.setItem(key, stringfiedValue);
  },
  getFromLocalStorage<T = string>(key: string): T | null {
    const value = localStorage.getItem(key);
    if (!value) return null;
    const parsedValue = value.startsWith('{') || value.startsWith('[') ? JSON.parse(value) : value;
    return parsedValue;
  },
  removeFromLocalStorage(key: string) {
    localStorage.removeItem(key);
  },
};
