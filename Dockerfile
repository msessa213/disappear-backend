# Use a lightweight Python base image
FROM python:3.11-slim

# Install git, nodejs, npm
RUN apt-get update && apt-get install -y git curl nodejs npm && rm -rf /var/lib/apt/lists/*

# Set the working directory inside the container
WORKDIR /app

# Copy the requirements file from the backend directory first
COPY backend/requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the project files into the container
COPY . .

# Build frontend SPA distribution
RUN cd frontend && npm install && npm run build

# Expose the port your FastAPI app runs on
EXPOSE 8000

# Shift working directory to the backend folder before starting
WORKDIR /app/backend

# Start the application and respect Railway's dynamic PORT environment variable
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]