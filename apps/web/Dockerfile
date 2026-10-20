FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json ./
COPY packages/contracts/package.json ./packages/contracts/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY prisma ./prisma

RUN npm ci

COPY packages/contracts ./packages/contracts
COPY apps/web ./apps/web
COPY tsconfig.json ./

RUN npm run prisma:generate

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm --workspace=@order-by-sms/web run build

EXPOSE 3000

CMD ["npm", "--workspace=@order-by-sms/web", "run", "start"]
