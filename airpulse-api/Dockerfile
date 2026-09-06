FROM python:3.11-slim-bookworm

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    YATRA_BROWSER_HEADLESS=false

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
RUN mkdir -p /ms-playwright && playwright install --with-deps chrome

COPY . .

# Fail the image build if the exact production browser cannot launch. This
# renders only a local HTML string and makes no request to Yatra.
RUN useradd --create-home airpulse && chown -R airpulse:airpulse /app
USER airpulse
RUN xvfb-run -a python scripts/check_chrome.py

EXPOSE 8000

CMD ["sh", "-c", "exec xvfb-run -a --server-args='-screen 0 1280x720x24 -nolisten tcp' python -m uvicorn app.main:app --host 0.0.0.0 --port \"${PORT:-8000}\" --workers 1"]
