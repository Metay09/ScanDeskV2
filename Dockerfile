# ── Stage 1: React build ──────────────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ── Stage 2: Production image ─────────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

# Sadece sunucu kodu + React build çıktısı kopyalanır
COPY --from=build /app/dist      ./dist
COPY --from=build /app/server    ./server
COPY --from=build /app/package*.json ./

# Sadece production bağımlılıkları kur (express, pg)
RUN npm ci --omit=dev

ENV PORT=3000
EXPOSE 3000

CMD ["node", "server/index.js"]
