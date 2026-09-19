FROM python:3.12-slim
WORKDIR /app

# Tectonic (LaTeX engine for the resume PDF), pinned; musl builds are self-contained
ARG TECTONIC_VERSION=0.15.0
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates \
    && arch="$(dpkg --print-architecture)" \
    && case "$arch" in arm64) triple=aarch64-unknown-linux-musl ;; amd64) triple=x86_64-unknown-linux-musl ;; *) echo "unsupported arch $arch" && exit 1 ;; esac \
    && curl -fsSL "https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%40${TECTONIC_VERSION}/tectonic-${TECTONIC_VERSION}-${triple}.tar.gz" \
       | tar -xz -C /usr/local/bin tectonic \
    && apt-get purge -y curl && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ .

# Bake tectonic's package cache into the image so the first resume request is fast
RUN python -c "from app.resume_tex import prewarm; prewarm()"
COPY frontend/dist /dist
EXPOSE 8000
RUN chmod +x /app/startup.sh
CMD ["/app/startup.sh"]
