# Multi-stage build for Gobering application

# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache libc6-compat python3 make g++

# Copy package files and install all dependencies (including dev for build)
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source code
COPY . .

# Accept build argument for Vite environment variables
ARG VITE_STRIPE_PUBLIC_KEY
ENV VITE_STRIPE_PUBLIC_KEY=$VITE_STRIPE_PUBLIC_KEY

# Build the application
ENV NODE_ENV=production
RUN npm run build

# Stage 2: Production dependencies (including drizzle-kit for migrations)
FROM node:20-alpine AS deps
WORKDIR /app

# Install dependencies for native modules
RUN apk add --no-cache libc6-compat python3 make g++

# Copy package files
COPY package.json package-lock.json* ./

# Install production dependencies + drizzle-kit for migrations
RUN npm ci --only=production && \
    npm install drizzle-kit && \
    npm cache clean --force

# Stage 3: Production
FROM node:20-alpine AS runner
WORKDIR /app

# Install runtime dependencies only
RUN apk add --no-cache libc6-compat

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 gobering

# Copy built application from builder
COPY --from=builder --chown=gobering:nodejs /app/dist ./dist

# Copy package.json and config files
COPY --from=builder --chown=gobering:nodejs /app/package.json ./
COPY --from=builder --chown=gobering:nodejs /app/drizzle.config.ts ./
COPY --from=builder --chown=gobering:nodejs /app/tsconfig.json ./

# Copy production dependencies from deps stage
COPY --from=deps --chown=gobering:nodejs /app/node_modules ./node_modules

# Copy runtime dependencies
COPY --from=builder --chown=gobering:nodejs /app/shared ./shared
COPY --from=builder --chown=gobering:nodejs /app/server ./server
COPY --from=builder --chown=gobering:nodejs /app/drizzle ./drizzle

# Copy public assets (profile pictures, etc.) and create uploads directory
COPY --from=builder --chown=gobering:nodejs /app/public ./public
RUN mkdir -p ./public/uploads && chown -R gobering:nodejs ./public

# Set environment variables
ENV NODE_ENV=production
ENV PORT=5000
ENV HOST=0.0.0.0

# Switch to non-root user
USER gobering

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application
CMD ["node", "dist/index.js"]
