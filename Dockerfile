# ── Stage 1: React build ──────────────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# Build-time env injection: VITE_ değişkenleri React bundle'ına gömülür.
# docker-compose.yml bu ARG'ları .env'den iletir.
ARG VITE_SERVER_URL=""
ARG VITE_API_KEY=""
ARG VITE_GSHEETS_URL=""
ENV VITE_SERVER_URL=$VITE_SERVER_URL
ENV VITE_API_KEY=$VITE_API_KEY
ENV VITE_GSHEETS_URL=$VITE_GSHEETS_URL

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
