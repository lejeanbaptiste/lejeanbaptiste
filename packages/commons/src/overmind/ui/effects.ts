import axios from 'axios';

export const api = {
  async getGAID() {
    const response = await axios.get<string>('./api/ga-measurement-id');
    return response.data;
  },
};
