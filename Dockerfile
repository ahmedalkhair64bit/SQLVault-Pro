# SQLVault-Pro Dockerfile
# Multi-stage build for optimized production image

# ============================================
# Stage 1: Build Frontend
# ============================================
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy frontend package files
COPY frontend/package*.json ./

# Install frontend dependencies
RUN npm ci

# Copy frontend source
COPY frontend/ ./

# Build the React app
RUN npm run build

# ============================================
# Stage 2: Production Image
# ============================================
FROM node:20-alpine AS production

# Install build dependencies for better-sqlite3 (native module)
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy backend package files
COPY backend/package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Remove build dependencies to reduce image size
RUN apk del python3 make g++

# Copy backend source
COPY backend/src ./src

# Copy built frontend from stage 1
COPY --from=frontend-builder /app/frontend/build ./public

# Copy entrypoint script
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Create data directory for SQLite database
RUN mkdir -p /app/data

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001
ENV DB_PATH=/app/data/inventory.db
ENV STATIC_PATH=/app/public

# Expose the application port
EXPOSE 3001

# Create a non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S sqlvault -u 1001 -G nodejs

# Change ownership of app directory
RUN chown -R sqlvault:nodejs /app

# Switch to non-root user
USER sqlvault

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

# Start the application via entrypoint
ENTRYPOINT ["./docker-entrypoint.sh"]
