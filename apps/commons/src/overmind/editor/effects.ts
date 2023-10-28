import axios from 'axios';
import { logHttpError } from '../../services/utilities';

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
      logHttpError(error);
      if (axios.isAxiosError(error)) {
        return new Error(error.message);
      }
      return new Error('error');
    }
  },
};
