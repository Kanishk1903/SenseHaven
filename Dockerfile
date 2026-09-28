# Multi-stage build (Phase 7 / P7.1): web build -> API runtime.
# Buildable once web/package-lock.json (Phase 4) and api/requirements.lock (Phase 2) exist.
FROM node:20-slim AS web
WORKDIR /build/web
COPY web/package.json web/package-lock.json* ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM python:3.11-slim AS api
WORKDIR /app
COPY api/requirements.lock ./api/requirements.lock
RUN pip install --no-cache-dir -r api/requirements.lock
COPY api/ ./api/
COPY --from=web /build/web/dist ./web/dist
RUN useradd --create-home appuser
USER appuser
ENV ENV=production
WORKDIR /app/api
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1 --proxy-headers"]
