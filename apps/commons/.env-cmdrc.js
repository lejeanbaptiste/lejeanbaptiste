const envs = {
  GA_MEASUREMENT_ID:'G-JG3NWYH6TY',
  GEONAMES_USERNAME:'LEAFwriter',
  KEYCLOAK_URL:'https://keycloak.dev.lincsproject.ca',
  AUTH_API_URL:'https://auth-api.dev.lincsproject.ca',
  NSSI_URL:'https://api.nssi.dev.lincsproject.ca/api',
}

module.exports = {
  development: {
    ...envs,
    NODE_ENV: 'development',
    WORKER_ENV: 'production',
  },
  ...envs,
  'development-worker-dev': {
    NODE_ENV: 'development',
    WORKER_ENV: 'development',
  },
  ...envs,
  production: {
    NODE_ENV: 'production',
    WORKER_ENV: 'production',
  },
};
