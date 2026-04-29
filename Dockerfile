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

# Если package-lock.json есть — используем ci для воспроизводимой сборки,
# иначе обычный install
RUN if [ -f package-lock.json ]; then \
      npm ci --prefer-offline; \
    else \
      npm install; \
    fi

# Копируем исходники
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
