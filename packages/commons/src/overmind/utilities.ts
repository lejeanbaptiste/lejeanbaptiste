import { log } from '@src/utilities';
import axios from 'axios';

export const handleAxiosError = (error: unknown) => {
  if (axios.isAxiosError(error)) {
    parseError(error);
    return parseError(error);
  }

  log.error(error);
  return new Error('error');
};

const parseError = (error: unknown) => {
  if (axios.isAxiosError(error)) {
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      log.error(error.response.data);
      log.error(error.response.status);
      log.error(error.response.headers);
    } else if (error.request) {
      // The request was made but no response was received
      // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
      // http.ClientRequest in node.js
      log.error(error.request);
    } else {
      // Something happened in setting up the request that triggered an Error
      log.error('Error', error.message);
    }
    return new Error(error.message);
  } else {
    log.error(error);
    return new Error('error');
  }
};
