import axios from 'axios';
import { handleAxiosError } from '../utilities';

export const api = {
  /**
   * Get geoname username from server
   * @returns The username for the geonames API
   */
  async getGeonameUsername() {
    try {
      const { data } = await axios.get<string>('./api/geonames-username');
      return data;
    } catch (error) {
      return handleAxiosError(error);
    }
  },
};
