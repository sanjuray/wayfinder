# ─────────────────────────────────────────────────────────────────────────────
# Wayfinder frontend — multi-stage build
#
# Stage 1 builds the Angular app to static files; stage 2 serves them with
# nginx. The Node toolchain (~1GB with node_modules) never ships — the runtime
# image is just nginx + the compiled dist (~50MB).
#
# The build takes a --build-arg to pick the Angular configuration (int/prod),
# which swaps in the right environment.*.ts (apiBaseUrl).
#
# Build context is the REPO ROOT (the folder holding backend/, frontend/,
# deploy/), so the build can see both frontend/ sources and deploy/nginx.conf:
#   docker build -f deploy/Dockerfile.frontend \
#     --build-arg NG_CONFIG=production -t wayfinder-frontend .
# (Compose sets context: . and dockerfile: deploy/Dockerfile.frontend.)
# ────────────────────────────────────────────────────────────────────────────

# ---- Stage 1: build ---------------------------------------------------------
FROM node:20-alpine AS build
WORKDIR /build
 
# Which Angular build configuration to use: "production" or "int".
# Defaults to production; override with --build-arg NG_CONFIG=int.
ARG NG_CONFIG=production
 
# Install deps as their own cached layer (see backend Dockerfile for the why).
# `npm ci` is the CI-appropriate install: exact lockfile versions, fails if
# package.json and lock are out of sync, and wipes node_modules first.
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
 
COPY frontend/ .
RUN npm run build -- --configuration=${NG_CONFIG}

# ---- Stage 2: runtime -------------------------------------------------------
FROM nginx:1.27-alpine AS runtime
 
# The nginx image auto-runs envsubst on files in /etc/nginx/templates/*.template
# at startup, writing results to /etc/nginx/conf.d/. Crucially it only
# substitutes the vars we name in NGINX_ENVSUBST_* — so ${BACKEND_URL} is
# replaced while nginx's own $host / $remote_addr are left intact.
COPY deploy/nginx.conf /etc/nginx/templates/default.conf.template
 
# Only BACKEND_URL is a shell-style variable in the template; list it so the
# nginx runtime substitutes exactly that and nothing else.
ENV NGINX_ENVSUBST_FILTER="BACKEND_URL"
# Sensible default for compose; overridden per-environment.
ENV BACKEND_URL="http://backend:8080”

# Angular 17+ outputs to dist/<project>/browser. The project name is
# "wayfinder" (angular.json), so the built files land in dist/wayfinder/browser.
COPY --from=build /build/dist/wayfinder/browser /usr/share/nginx/html
 
# Listens on 8080 (see nginx.conf) so workers need no root.
EXPOSE 8080
 
# nginx:alpine's default entrypoint runs the envsubst template step, then starts
# nginx in the foreground as PID 1. No override needed.
