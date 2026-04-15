# Use a slim Python image for a smaller footprint
FROM python:3.11-slim

# Set environment variables to prevent Python from buffering logs
# This is crucial for seeing real-time logs in AWS CloudWatch
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install system dependencies required for PostgreSQL and general builds
RUN apt-get update && apt-get install -y \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Explicitly install all production libraries
# Added 'stripe' for payments and 'gunicorn' for high-traffic stability
RUN pip install --no-cache-dir \
    fastapi \
    uvicorn \
    gunicorn \
    sqlalchemy \
    psycopg2-binary \
    python-dotenv \
    pydantic \
    python-multipart \
    stripe

# Copy your backend source code into the container
COPY . .

# EXPOSE port 8000 for AWS routing
EXPOSE 8000

# Start the server using Gunicorn with Uvicorn workers
# -w 4: 4 concurrent processes (Handles multiple paying users simultaneously)
# -k uvicorn.workers.UvicornWorker: The high-speed async bridge
# --timeout 120: Prevents the worker from killing long-running "Purge" tasks
CMD ["gunicorn", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "main:app", "--bind", "0.0.0.0:8000", "--timeout", "120"]