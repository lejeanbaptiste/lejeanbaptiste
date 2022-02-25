FROM node:16.14

WORKDIR /app

RUN npm install pm2 ts-node -g

COPY ./packages/standalone .

RUN npm install

RUN NODE_OPTIONS=--max_old_space_size=4096 npm run build

CMD ["pm2-runtime", "ecosystem.config.js"]

EXPOSE 3000
