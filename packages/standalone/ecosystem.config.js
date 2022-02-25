const env = require('./.env-cmdrc').production;

module.exports = {
  apps: [
    {
      name: 'leaf-writer',
      script: 'ts-node ./server/index.ts',
      args: '--no-daemon',
      env,
    },
  ],
};
