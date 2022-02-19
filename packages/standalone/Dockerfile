# CWRC-Writer

FROM node:16.13

WORKDIR /app

RUN npm install pm2 -g

COPY . .

RUN npm install && \
    npm run build

CMD ["pm2-runtime", "ecosystem.config.js"]

EXPOSE 3000
