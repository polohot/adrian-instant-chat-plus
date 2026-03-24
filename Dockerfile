# Use Node.js 22 as the base image (supports TS stripping)
FROM node:22-slim

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application code
COPY . .

# Build the frontend
RUN npm run build

# Set environment to production
ENV NODE_ENV=production

# Expose the port
EXPOSE 8000

# Start the application
CMD ["npm", "start"]