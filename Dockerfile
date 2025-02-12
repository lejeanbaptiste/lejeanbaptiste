FROM node:22.11-alpine AS base
WORKDIR /app


# 1. Build the source code only when needed
FROM base AS builder
RUN apk add --no-cache git
COPY . .
RUN \
  if [ -f package-lock.json ]; then npm ci; \
  else npm install; \
  fi
ENV NODE_ENV=production
RUN NODE_OPTIONS=--max_old_space_size=4096 npm run build-commons
USER node
EXPOSE 3000
ENV PORT 3000

CMD ["node", "apps/commons/server/index.js"]