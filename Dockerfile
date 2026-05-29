# Use a lightweight Python base image
FROM python:3.11-slim

# Install git (needed for installing python packages via git+)
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

# Set the working directory inside the container
WORKDIR /app

# Copy the requirements file from the backend directory first
COPY backend/requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the project files into the container
COPY . .

# Expose the port your FastAPI app runs on
EXPOSE 8000

# Start the application from the backend module
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]