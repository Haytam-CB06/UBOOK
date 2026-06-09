FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
ARG VITE_API_BASE_URL=http://localhost:8080/api
ARG VITE_REQUIRE_AUTH=true
ARG VITE_AUTH_SESSION_STORAGE=local
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_REQUIRE_AUTH=$VITE_REQUIRE_AUTH
ENV VITE_AUTH_SESSION_STORAGE=$VITE_AUTH_SESSION_STORAGE
RUN npm run build

EXPOSE 5173
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "5173", "--strictPort"]
