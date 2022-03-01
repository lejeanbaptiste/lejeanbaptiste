module.exports = {
  'development': {
    NODE_ENV: 'development',
    WORKER_ENV: 'production',
    AUTHORIZATION_CALLBACK_URL: process.env.AUTHORIZATION_CALLBACK_URL || 'https://localhost',
  },
  'development-worker-dev': {
    NODE_ENV: 'development',
    WORKER_ENV: 'development',
    AUTHORIZATION_CALLBACK_URL: process.env.AUTHORIZATION_CALLBACK_URL || 'https://localhost',
  },
  production: {
    NODE_ENV: 'production',
    WORKER_ENV: 'production',
    AUTHORIZATION_CALLBACK_URL: process.env.AUTHORIZATION_CALLBACK_URL || 'https://localhost',
    GA_MEASUREMENT_ID: process.env.GA_MEASUREMENT_ID,
  },
};
