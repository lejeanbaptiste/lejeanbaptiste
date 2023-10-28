import axios from 'axios';

export const api = {
  /**
   * Get  Google Analytics Measurement ID from the server
   * @returns The Google Analytics Measurement ID
   */
  async getGAID() {
    const { data } = await axios.get<string>('./api/ga-measurement-id');
    return data;
  },
};
