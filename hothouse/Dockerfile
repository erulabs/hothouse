# syntax=docker/dockerfile:1

FROM node:22-bullseye-slim AS node-version
ARG CACHEBUST
RUN --mount=type=cache,target=/var/cache/apt,rw,sharing=locked \
  --mount=type=cache,target=/var/lib/apt,rw,sharing=locked \
  apt-get update -yqq && \
  apt-get install -yqq bash curl netcat procps libreoffice


FROM node-version AS deps
WORKDIR /app
ENV YARN_CACHE_FOLDER=/home/node/.cache
ENV TZ=UTC
COPY ./.yarn/releases/*.cjs /app/.yarn/releases/
COPY package.json yarn.lock .yarnrc.yml .npmr[c] ./
RUN --mount=type=cache,mode=0777,target=/home/node/.cache,uid=1000 \
  corepack enable && \
  corepack prepare && \
  yarn --immutable


FROM node-version AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --chown=node:node . .
RUN --mount=type=cache,mode=0777,target=/app/.next/cache,uid=1000 \
  --mount=type=secret,id=NEXT_PUBLIC_APP_ENV,env=NEXT_PUBLIC_APP_ENV \
  --mount=type=secret,id=NEXT_PUBLIC_APP_BUILD_ID,env=NEXT_PUBLIC_APP_BUILD_ID \
  --mount=type=secret,id=NEXT_PUBLIC_STATIC_ASSET_PATH,env=NEXT_PUBLIC_STATIC_ASSET_PATH \
  --mount=type=secret,id=NODE_ENV,env=NODE_ENV \
  echo "NEXT_PUBLIC_APP_ENV: $NEXT_PUBLIC_APP_ENV" && \
  echo "NEXT_PUBLIC_APP_BUILD_ID: $NEXT_PUBLIC_APP_BUILD_ID" && \
  echo "NEXT_PUBLIC_STATIC_ASSET_PATH: $NEXT_PUBLIC_STATIC_ASSET_PATH" && \
  corepack enable && \
  corepack prepare && \
  NEXT_PUBLIC_APP_ENV=$NEXT_PUBLIC_APP_ENV \
  NEXT_PUBLIC_APP_BUILD_ID=$NEXT_PUBLIC_APP_BUILD_ID \
  NEXT_PUBLIC_STATIC_ASSET_PATH=$NEXT_PUBLIC_STATIC_ASSET_PATH \
  NODE_ENV=$NODE_ENV \
  yarn build


FROM deps AS dev
ENV NODE_ENV=development \
    NEXT_TELEMETRY_DISABLED=1
COPY --chown=node:node . .
EXPOSE 3000
ENTRYPOINT [ "yarn", "dev" ]


FROM node-version AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
USER node
EXPOSE 3000
CMD ["node", "server.js"]
