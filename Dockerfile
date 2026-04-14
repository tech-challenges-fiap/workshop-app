FROM oven/bun:1.3.6 AS build

WORKDIR /app

COPY package.json tsconfig.json ./
COPY src ./src

RUN bun build ./src/server.ts --outdir dist --target bun

FROM oven/bun:1.3.6-slim

WORKDIR /app

COPY --from=build /app/dist ./dist

ENV PORT=3000

EXPOSE 3000

CMD ["bun", "dist/server.js"]

