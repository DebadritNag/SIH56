FROM python:3.11-slim-bookworm

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    YATRA_BROWSER_HEADLESS=false \
    YATRA_DISABLE_HTTP2=true

# Limit numerical-library thread pools when analytics is loaded beside Chrome.
ENV OMP_NUM_THREADS=1 \
    OPENBLAS_NUM_THREADS=1 \
    MKL_NUM_THREADS=1 \
    NUMEXPR_NUM_THREADS=1 \
    MALLOC_ARENA_MAX=2

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    libpq-dev \
    xvfb \
    xauth \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

# Install Playwright browsers at build time so the container image is self-contained.
# chrome  — used by YatraBrowserCollector / HappyFares (existing)
# chromium — used by Crawl4AI (new)
# --with-deps installs all required Linux system libraries for both channels.
RUN mkdir -p /ms-playwright \
    && playwright install --with-deps chrome \
    && playwright install --with-deps chromium

# Crawl4AI post-install: downloads its lightweight default extraction model.
# Run with --skip-chromium because the Playwright chromium above is reused.
RUN crawl4ai-setup --skip-chromium || python -c "import crawl4ai; print('crawl4ai ready')"

COPY . .

# Fail the image build if the exact production browser cannot launch. This
# renders only a local HTML string and makes no request to Yatra.
RUN useradd --create-home airpulse && chown -R airpulse:airpulse /app \
    && install -d -o root -g root -m 1777 /tmp/.X11-unix
USER airpulse
RUN xvfb-run -a python scripts/check_chrome.py

EXPOSE 10000

CMD ["python", "-u", "-m", "scripts.start_server"]
