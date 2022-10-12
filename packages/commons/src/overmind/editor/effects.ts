import axios from 'axios';

export const api = {
  /**
   * Get geoname username from server
   * @returns The username for the geonames API
   */
  async getGeonameUsername() {
    const { data } = await axios.get<string>('./api/geonames-username');
    return data;
  },
};
