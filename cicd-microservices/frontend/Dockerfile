# Stage 1: Build (just organize files)
FROM node:18-alpine AS builder
WORKDIR /app
COPY index.html style.css app.js ./

# Stage 2: Production with Nginx
FROM nginx:1.25-alpine AS production
RUN rm -rf /usr/share/nginx/html/*
COPY --from=builder /app/index.html /usr/share/nginx/html/
COPY --from=builder /app/style.css /usr/share/nginx/html/
COPY --from=builder /app/app.js /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/nginx-health || exit 1
CMD ["nginx", "-g", "daemon off;"]
