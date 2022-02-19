//TODO needs to be updated
const GA_MEASUREMENT_ID = 'UA-29631253-4';

module.exports = {
  'development': {
    NODE_ENV: 'development',
    WORKER_ENV: 'production',
  },
  'development-worker-dev': {
    NODE_ENV: 'development',
    WORKER_ENV: 'development',
  },
  production: {
    NODE_ENV: 'production',
    WORKER_ENV: 'production',
    GA_MEASUREMENT_ID,
  },
};
