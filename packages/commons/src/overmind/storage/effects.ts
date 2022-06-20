import axios from 'axios';

export const localAPI = {
  async loadTemplate(url: string) {
    const response = await axios.get(url);
    return response.data;
  },
};
