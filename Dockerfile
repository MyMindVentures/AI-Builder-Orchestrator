# Multi-stage build for AI Builder Orchestrator
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Production stage
FROM node:18-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S orchestrator -u 1001

# Set working directory
WORKDIR /app

# Copy built application from builder stage
COPY --from=builder --chown=orchestrator:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=orchestrator:nodejs /app/src ./src
COPY --from=builder --chown=orchestrator:nodejs /app/package*.json ./

# Create data directory
RUN mkdir -p data logs && chown -R orchestrator:nodejs data logs

# Switch to non-root user
USER orchestrator

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
ENTRYPOINT ["dumb-init", "--"]

# Default to running the orchestrator service
# For jobs, override with: CMD ["node", "src/jobs/knowledge-extraction-job.js"]
CMD ["node", "src/index.js"]
