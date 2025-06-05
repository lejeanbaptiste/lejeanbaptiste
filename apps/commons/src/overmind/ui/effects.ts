export const api = {
  /**
   * Get  Google Analytics Measurement ID from the server
   * @returns The Google Analytics Measurement ID
   */
  async getGAID() {
    const response = await fetch('./api/ga-measurement-id');
    const data = await response.text();
    return data;
  },
};
