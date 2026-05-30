# Stage 1: build frontend
FROM node:22-slim AS frontend-build
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: backend runtime
FROM python:3.12-slim
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ .
COPY --from=frontend-build /frontend/dist /dist
EXPOSE 8000
RUN chmod +x /app/startup.sh
CMD ["/app/startup.sh"]
