# Build stage: also used by the `migrate` service, which needs the Prisma CLI
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma ./prisma
COPY prisma7.config.ts tsconfig.json ./
RUN npm run db:generate
COPY src ./src
RUN npm run build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
RUN npm prune --omit=dev
# The generated Prisma client isn't a package, so put it back in case prune dropped it
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/dist ./dist
RUN mkdir uploads && chown node:node uploads
USER node
EXPOSE 3000
CMD ["node", "dist/server.js"]
