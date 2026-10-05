FROM node:21-alpine

# Install ffmpeg
RUN apk add --no-cache ffmpeg

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy application files
COPY . .

# Create necessary directories
RUN mkdir -p uploads logs tmp

# Expose port
EXPOSE 3000

# Start application
CMD ["node", "app.js"]
