# Use a lightweight, stable official Python image
FROM python:3.11-slim

# Set the working directory
WORKDIR /app

# Install essential build tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Upgrade pip and install dependencies
RUN pip install --no-cache-dir --upgrade pip
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy all application files
COPY . .

# Set environment variables to force package lookup
ENV PYTHONPATH=/usr/local/lib/python3.11/site-packages
ENV PYTHONNOUSERSITE=1

# Expose the port
EXPOSE 8000

# Diagnostic CMD: Prints environment info then runs the app
CMD ["sh", "-c", "echo '--- PIP PACKAGES ---' && pip list | grep lithic && echo '--- PYTHON PATH ---' && python -c 'import sys; print(sys.path)' && echo '--- IMPORT DIAGNOSTIC ---' && python -c 'import lithic; print(f\"Lithic loaded from: {lithic.__file__}\")' && uvicorn main:app --host 0.0.0.0 --port 8000"]