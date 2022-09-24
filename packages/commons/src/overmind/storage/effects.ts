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
