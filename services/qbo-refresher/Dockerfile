FROM node:20-slim
WORKDIR /app
COPY package.json ./
RUN corepack enable && corepack prepare pnpm@10.17.0 --activate \
 && pnpm i --prod
COPY . .
CMD ["node", "index.js"]

