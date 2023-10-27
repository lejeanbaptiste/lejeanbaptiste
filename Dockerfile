FROM node:20.9-alpine

# Needed because some dependencies are fetch from git and alpine does not come with git
RUN apk add --no-cache git

RUN npm install ts-node -g

WORKDIR /app
COPY . .

RUN npm install
ENV NODE_ENV=production

WORKDIR /app/packages/commons
RUN NODE_OPTIONS=--max_old_space_size=4096 npm run build

ENV PORT 3000
EXPOSE 3000

CMD ["ts-node", "./server/index.ts"]