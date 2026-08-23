# Build stage
FROM node:20-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.25.0 --activate

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/
COPY prisma.config.ts ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Generate Prisma Client
RUN pnpm prisma:generate

# Build the application
RUN pnpm build

# Production stage
FROM node:20-alpine AS production

ARG DEPLOY_VERSION=dev
ENV DEPLOY_VERSION=$DEPLOY_VERSION

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.25.0 --activate

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/
COPY prisma.config.ts ./

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

# Copy built application and runtime assets from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/languages ./languages
COPY assets/audio ./assets/audio

# Generate Prisma Client (needed for production)
RUN pnpm prisma:generate

# Create a non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership of the app directory
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose API port
EXPOSE 4000

# Run migrations and start the application
CMD ["sh", "-c", "pnpm prisma migrate deploy && node dist/index.js"]
