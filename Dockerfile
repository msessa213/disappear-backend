# Use a lightweight Python base image
FROM python:3.11-slim

# Set the working directory inside the container
WORKDIR /app

# Copy the requirements file from the backend directory first
# (This allows Docker to cache the installation step)
COPY backend/requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the project files into the container
COPY . .

# Expose the port your FastAPI app runs on
EXPOSE 8000

# Start the application from the backend module
# (This points to backend/main.py, running the app instance)
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]