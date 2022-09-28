import axios from 'axios';

export const api = {
  async loadTemplates() {
    const response = await axios.get('./content/templates.json');
    return response.data;
  },
  async loadSampleDocuments() {
    const response = await axios.get('./content/sampleDocuments.json');
    return response.data;
  },
  async loadTemplate(url: string) {
    const response = await axios.get(url);
    return response.data;
  },
  saveToLocalStorage: (key: string, value: unknown) => {
    const stringfiedValue = typeof value === 'string' ? value : JSON.stringify(value);
    localStorage.setItem(key, stringfiedValue);
  },
  getFromLocalStorage: (key: string) => {
    const value = localStorage.getItem(key);
    if (!value) return null;
    const parsedValue = value.startsWith('{') || value.startsWith('[') ? JSON.parse(value) : value;
    return parsedValue;
  },
  removeFromLocalStorage: (key: string) => {
    localStorage.removeItem(key);
  },
};
