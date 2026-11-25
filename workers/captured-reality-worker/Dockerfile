FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY index.js lifecycle-authority.js reconstruction-engine.js reconstruction-evidence.js reconstruction-holdout.js reconstruction-masks.js private-media-resolver.js gaussian-package.js ./
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080
CMD ["node","index.js"]
