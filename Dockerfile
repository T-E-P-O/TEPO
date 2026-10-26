# ==========================================
# STAGE 1: Build Frontend (React + TypeScript + Vite)
# ==========================================
FROM node:24-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# ==========================================
# STAGE 2: Build Backend (Java 21 + Spring Boot + Google OR-Tools)
# ==========================================
FROM maven:3.9-eclipse-temurin-21 AS backend-builder
WORKDIR /app

# Cache Maven dependencies
COPY backend/pom.xml ./backend/
RUN cd backend && mvn dependency:go-offline -B || true

# Copy backend source
COPY backend/src ./backend/src

# Copy compiled frontend dist into Spring Boot static resources
COPY --from=frontend-builder /app/frontend/dist ./backend/src/main/resources/static/

# Package executable JAR (tests run in CI, skip here for fast production build)
RUN cd backend && mvn clean package -DskipTests

# ==========================================
# STAGE 3: Production Runtime
# ==========================================
FROM eclipse-temurin:21-jre-jammy
WORKDIR /app

# Install native libraries required by Google OR-Tools (libgomp1) and curl for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends curl libgomp1 && rm -rf /var/lib/apt/lists/*

COPY --from=backend-builder /app/backend/target/*.jar app.jar
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

ENV PORT=8080
ENV SPRING_PROFILES_ACTIVE=demo

EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -sf http://localhost:${PORT}/api/scenarios/ping || exit 1

ENTRYPOINT ["/docker-entrypoint.sh"]
