# Use Node 20 (Vite requires 20.19+ or 22.12+)
FROM node:20-alpine

WORKDIR /app

# Copy dependency files first
COPY package*.json ./

# CRITICAL: Remove any existing node_modules or lock files.
# This prevents the '@rollup/rollup-linux-x64-musl' error by forcing 
# a fresh install specifically for the Linux container.
RUN rm -rf node_modules package-lock.json

# Install dependencies inside the container
RUN npm install

# Copy the rest of the Disappear code
COPY . .

# Inform Docker that the container listens on port 3000
EXPOSE 3000

# Start the development server
CMD ["npm", "run", "dev"]