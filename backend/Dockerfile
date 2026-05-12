# Use a slim Python image for a smaller footprint
FROM python:3.11-slim

# Set environment variables to prevent Python from buffering logs
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install system dependencies required for PostgreSQL and general builds
RUN apt-get update && apt-get install -y \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements first to leverage Docker caching
COPY requirements.txt .

# Install all libraries from requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy your backend source code into the container
COPY . .

# EXPOSE port 8000 for AWS routing
EXPOSE 8000

# Using 'python -m gunicorn' is a fail-safe that ensures the binary is found
CMD ["python", "-m", "gunicorn", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "main:app", "--bind", "0.0.0.0:8000", "--timeout", "120"]