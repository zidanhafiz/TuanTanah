# Optional: build the client to static files inside a container.
# The default compose flow instead builds on the host (`pnpm build`) and mounts
# client/dist into the nginx container. Provided for parity / CI use.
FROM node:20-alpine AS build
RUN corepack enable
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY shared/package.json ./shared/
COPY client/package.json ./client/
RUN pnpm install --frozen-lockfile --filter @tuan-tanah/client...
COPY tsconfig.base.json ./
COPY shared ./shared
COPY client ./client
RUN pnpm --filter @tuan-tanah/client build

FROM nginx:alpine
COPY --from=build /app/client/dist /usr/share/nginx/html
