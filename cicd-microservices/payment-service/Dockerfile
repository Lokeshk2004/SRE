# Stage 1: Build
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY src/ ./src/

# Stage 2: Production
FROM node:18-alpine AS production
RUN addgroup -g 1001 appgroup && adduser -u 1001 -G appgroup -D appuser
WORKDIR /app
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/src ./src
COPY --from=builder --chown=appuser:appgroup /app/package.json ./
ENV NODE_ENV=production
ENV PORT=3003
EXPOSE 3003
USER appuser
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3003/health || exit 1
CMD ["node", "src/index.js"]
