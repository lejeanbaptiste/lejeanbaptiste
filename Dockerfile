FROM node:18.12-alpine

# Needed because some dependencies are fetch from git and alpine does not come with git
# RUN apk add --no-cache git

RUN npm install pm2 ts-node -g

WORKDIR /app

COPY ./packages/commons/package.json .

RUN npm install

COPY ./packages/commons .

RUN NODE_OPTIONS=--max_old_space_size=4096 npm run build

CMD ["pm2-runtime", "ecosystem.config.js"]

EXPOSE 3000
