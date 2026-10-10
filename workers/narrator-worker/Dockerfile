FROM node:22-slim@sha256:c3de60bf2f9dd0ac6370e6117950ff62d6e339527e7472301c9c78a017978392

RUN apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && npm install --global pnpm@8.15.9

WORKDIR /app

COPY runtime-source/ ./
COPY narrator-runtime-source.json /narrator-runtime-source.json

RUN git read-tree HEAD \
  && node -e "const fs=require('fs'),cp=require('child_process');const receipt=JSON.parse(fs.readFileSync('/narrator-runtime-source.json','utf8'));if(receipt.repository!=='LifeLoggerAI/urai-jobs'||!receipt.sourceOnly||receipt.spendAuthorized||receipt.deploymentAuthorized||receipt.runtimeAccepted||cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()!==receipt.sourceSha)throw new Error('Exact narrator build source unavailable');" \
  && pnpm install --frozen-lockfile --filter narrator-worker... --ignore-scripts \
  && pnpm --filter @urai-jobs/shared-types build \
  && pnpm --filter narrator-worker build \
  && node workers/narrator-worker/runtime-source-proof.cjs seal \
  && node workers/narrator-worker/runtime-source-proof.cjs verify-runtime \
  && test -z "$(git status --porcelain --untracked-files=all -- package.json pnpm-lock.yaml pnpm-workspace.yaml workers/narrator-worker packages/shared-types)"

WORKDIR /app/workers/narrator-worker

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", "dist/index.js"]
