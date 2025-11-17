FROM node:18-alpine

WORKDIR /app

# Copy package.json first (required)
COPY package.json ./

# Copy package-lock.json if it exists (optional)
COPY package-lock.json* ./

# Install dependencies
RUN npm install --production=false

# Copy application files
COPY . .

# Copy entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Expose port
EXPOSE 3001

# Use entrypoint to wait for database and create it if needed
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["npm", "start"]

