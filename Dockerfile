FROM node:22.16-alpine AS base
RUN apk add --no-cache git
RUN apk add --update npm
RUN npm i -g changeset typescript webpack shelljs webpack-cli


# 1. Build the source code only when needed
FROM base AS builder
USER node
WORKDIR /app
COPY --chown=node:node . .
RUN \
  if [ -f package-lock.json ]; then npm ci; \
  else npm install; \
  fi
ENV NODE_ENV=production
RUN NODE_OPTIONS=--max_old_space_size=4096 npm run build-commons
EXPOSE 3000
ENV PORT 3000

CMD ["node", "apps/commons/server/index.js"]
