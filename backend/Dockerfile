FROM python:3.12-slim
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ .
COPY frontend/dist /dist
EXPOSE 8000
RUN chmod +x /app/startup.sh
CMD ["/app/startup.sh"]
