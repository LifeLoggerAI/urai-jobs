FROM node:22-slim

WORKDIR /app

COPY package.json ./
RUN npm install --omit=optional

COPY tsconfig.json ./tsconfig.json
COPY src ./src

RUN npm run build && npm prune --omit=dev

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", "dist/index.js"]
