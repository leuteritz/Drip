# Stage 1: build the static frontend
FROM node:22-alpine AS build

WORKDIR /build

COPY package.json package-lock.json ./
RUN npm ci --no-fund --no-audit

COPY . .
# Call the tools directly (npm swallows forwarded flags on some platforms)
# and override the default outDir (../backend/static) inside the container
RUN npx tsc -b && npx vite build --outDir dist --emptyOutDir

# Stage 2: serve it with nginx and proxy /api to the backend container
FROM nginx:alpine

COPY --from=build /build/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
