# Use a slim Python image for a smaller footprint
FROM python:3.11-slim

# Install system dependencies required for PostgreSQL and general builds
RUN apt-get update && apt-get install -y \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Explicitly install all libraries mentioned in your main.py errors
RUN pip install --no-cache-dir \
    fastapi \
    uvicorn \
    sqlalchemy \
    psycopg2-binary \
    python-dotenv \
    pydantic \
    python-multipart

# Copy your backend source code into the container
COPY . .

# Start the FastAPI server on port 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]