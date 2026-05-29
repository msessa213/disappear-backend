FROM python:3.11-slim

WORKDIR /app

# Install build essentials
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Upgrade pip
RUN pip install --no-cache-dir --upgrade pip

# Copy and install requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy all application files
COPY . .

# EXPLICITLY set PYTHONPATH so Python finds the installed packages
ENV PYTHONPATH=/usr/local/lib/python3.11/site-packages:/app

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]