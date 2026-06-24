FROM node:20-alpine

# Install build dependencies for compiling sqlite3 native binary if fallback is needed
RUN apk add --no-cache python3 make g++

# Set working directory inside the container
WORKDIR /usr/src/app

# Copy dependency list
COPY package*.json ./

# Install npm dependencies (production only)
RUN npm ci --omit=dev

# Copy application files
COPY . .

# Expose application port
EXPOSE 3000

# Default environment configurations
ENV NODE_ENV=production
ENV DB_PATH=/usr/src/app/data/estoque.db

# Command to execute
CMD ["npm", "start"]
