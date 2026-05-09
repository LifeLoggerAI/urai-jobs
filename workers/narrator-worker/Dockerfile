FROM node:22-slim

WORKDIR /app

COPY package.json ./
RUN node -e "const fs=require('fs');const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));delete pkg.dependencies['@urai-jobs/shared-types'];fs.writeFileSync('package.json',JSON.stringify(pkg,null,2));" \
  && npm install

COPY tsconfig.json ./tsconfig.json
COPY src ./src

RUN npm run build

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", "dist/index.js"]
