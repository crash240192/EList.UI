# ============================================================
# Dockerfile — EList UI (React + Vite)
# Multistage build:
#   Stage 1 (builder) — устанавливает зависимости и собирает приложение
#   Stage 2 (runner)  — минимальный nginx образ с готовой сборкой
# ============================================================

# ---- Stage 1: Build ----
FROM node:20-alpine AS builder

WORKDIR /app

# Копируем манифесты отдельно — используем кеш слоёв Docker
# если package.json не менялся, npm ci пропускается
COPY package.json package-lock.json* ./

# devDependencies (typescript, vite) нужны для npm run build.
# --include=dev: даже если в CI задан NODE_ENV=production
RUN if [ -f package-lock.json ]; then \
      npm ci --prefer-offline --include=dev; \
    else \
      npm install --include=dev; \
    fi

# Копируем исходники
# CACHE_BUST обновляется при каждом деплое чтобы не использовался старый кеш исходников
ARG CACHE_BUST=1
COPY . .

# Переменные окружения для сборки.
# Переопределяются через --build-arg при docker build
# или через .env файл (см. ниже)
ARG VITE_YANDEX_MAPS_KEY=ea3f78ff-3c27-4101-a391-8c0a1d703833
ARG VITE_USE_MOCK=false
ARG VITE_YANDEX_AD_BLOCK_ID=R-A-1234567

ENV VITE_YANDEX_MAPS_KEY=$VITE_YANDEX_MAPS_KEY
ENV VITE_USE_MOCK=$VITE_USE_MOCK
ENV VITE_YANDEX_AD_BLOCK_ID=$VITE_YANDEX_AD_BLOCK_ID

# TypeScript проверка + Vite production build
RUN npm run build

# ---- Stage 2: Serve ----
FROM nginx:1.27-alpine AS runner

# Удаляем дефолтный nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Копируем nginx конфиг как шаблон (envsubst подставит BACKEND_URL при старте)
COPY nginx.conf /etc/nginx/conf.d/default.conf.template

# Копируем собранное приложение из stage 1
COPY --from=builder /app/dist /usr/share/nginx/html

# Копируем entrypoint
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN sed -i 's/\r//' /docker-entrypoint.sh && \
    chmod +x /docker-entrypoint.sh && \
    chown -R nginx:nginx /usr/share/nginx/html && \
    chmod -R 755 /usr/share/nginx/html

EXPOSE 80

ENTRYPOINT ["/docker-entrypoint.sh"]
