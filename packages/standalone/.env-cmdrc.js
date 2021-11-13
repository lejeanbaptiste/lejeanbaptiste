//TODO needs to be updated
const GA_MEASUREMENT_ID = 'UA-29631253-4';

module.exports = {
  'development-worker-3000': {
    NODE_ENV: 'development',
    WEBPACK_DEV: 'true',
    WORKER_ENV: 'development',
  },
  'development-worker-docker': {
    NODE_ENV: 'development',
    WEBPACK_DEV: 'false',
    WORKER_ENV: 'development',
  },
  development3000: {
    NODE_ENV: 'development',
    WORKER_ENV: 'development',
    WEBPACK_DEV: 'true',
  },
  developmentDocker: {
    NODE_ENV: 'development',
    WEBPACK_DEV: 'false',
    WORKER_ENV: 'development',
  },
  production: {
    NODE_ENV: 'production',
    WORKER_ENV: 'development',
    GA_MEASUREMENT_ID,
  },
};
