module.exports = {
  development: {
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
  },
};
