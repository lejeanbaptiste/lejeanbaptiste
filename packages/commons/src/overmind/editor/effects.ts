import axios from 'axios';

export const api = {
  async getGeonameUsername() {
    const response = await axios.get<string>('./api/geonames-username');
    return response.data;
  }
};
