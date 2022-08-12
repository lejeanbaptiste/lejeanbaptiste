import axios from 'axios';

export const api = {
  async loadTemplate(url: string) {
    const response = await axios.get(url);
    return response.data;
  },
};
