FROM node:22-slim

# Install libsecret for keytar (gracefully falls back to ENV vars in containers)
RUN apt-get update && apt-get install -y libsecret-1-dev && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --production=false
COPY . .
RUN npm run build
RUN npm prune --production

# Run as a non-root user. The session store writes under $HOME (env-paths data
# dir), so point HOME at the app dir and make it writable by the user. Group
# root + g+rwX keeps this OpenShift / arbitrary-UID friendly.
ENV HOME=/app
RUN useradd -r -u 1001 -g root nodeuser \
    && mkdir -p /app/.local/share \
    && chown -R nodeuser:root /app \
    && chmod -R g+rwX /app
USER nodeuser

EXPOSE 8080

# Container mode: use ENV vars for credentials (no keychain available)
# Required: LUNCH_MONEY_API_TOKEN
# For OAuth: AUTH_PROVIDER, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET (or equivalent)
CMD ["node", "dist/cli.js", "--http"]
