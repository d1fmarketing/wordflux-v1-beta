# Minimal runtime for the TaskCafe MCP server
FROM node:20-slim

WORKDIR /app

# Install only the dependencies required by the standalone MCP server
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy the transpiled server and supporting providers
COPY server.js ./server.js
COPY lib ./lib

ENV NODE_ENV=production
CMD ["node", "/app/server.js"]
