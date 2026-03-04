FROM node:22-slim AS base
WORKDIR /app

# Install Playwright deps and chromium
RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates wget libnss3 libatk1.0-0 libatk-bridge2.0-0 libdrm-dev libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm-dev libpango-1.0-0 libcairo2 libasound2 fonts-noto-color-emoji && \
    rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm install
RUN npx playwright install chromium

FROM base AS build
COPY --from=deps /app/node_modules /app/node_modules
COPY . .
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production \
    PLAYWRIGHT_BROWSERS_PATH=/app/ms-playwright
WORKDIR /app
COPY --from=deps /app/node_modules /app/node_modules
COPY --from=deps /root/.cache/ms-playwright /app/ms-playwright
COPY --from=build /app/dist /app/dist
COPY fixtures fixtures
COPY README.md README.md

CMD ["node", "dist/server.js"]
