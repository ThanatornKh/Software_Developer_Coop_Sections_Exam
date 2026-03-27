# Stage 1: Build frontend
FROM node:18-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
# Build outputs to ../backend/public (i.e. /app/backend/public)
RUN npm run build

# Stage 2: Production backend
FROM node:18-alpine
WORKDIR /app

# Copy backend source
COPY backend/package*.json ./
RUN npm install --production
COPY backend/ ./

# Copy built frontend assets from stage 1 into backend/public
COPY --from=frontend-build /app/backend/public ./public

# Copy Schema.sql for auto-init
COPY Schema.sql ../Schema.sql

ENV NODE_ENV=production
EXPOSE ${PORT:-4000}

CMD ["node", "src/server.js"]
