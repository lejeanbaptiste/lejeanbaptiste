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
};
