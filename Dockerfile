# Node server (Express) with password protection + cross-device sync
FROM node:20-alpine

WORKDIR /app

# Install deps first for better layer caching
COPY package.json ./
RUN npm install --omit=dev

# Copy the rest of the app
COPY server.js index.html ./

EXPOSE 8080
CMD ["node", "server.js"]
