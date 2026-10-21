FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache libc6-compat postgresql-client

COPY package.json package-lock.json ./
COPY packages/contracts/package.json ./packages/contracts/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY prisma ./prisma

RUN npm ci

COPY packages/contracts ./packages/contracts
COPY apps/api ./apps/api
COPY tsconfig.json ./

RUN npm run prisma:generate
RUN npm run build:api

EXPOSE 4000

CMD ["node", "apps/api/dist/apps/api/src/main.js"]
