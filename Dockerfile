# gt-web — SvelteKit SSR (adapter-node) behind the gt-app-proxy Traefik.
# Multi-stage: build the app, then ship a lean node runtime.
#
# schema.d.ts is committed, so the build needs no backend at image-build time.
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps
COPY . .
RUN npm run build && npm prune --omit=dev --legacy-peer-deps

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
EXPOSE 3000
CMD ["node", "build/index.js"]
