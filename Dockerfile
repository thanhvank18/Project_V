FROM node:24-alpine
RUN apk add --no-cache su-exec
WORKDIR /app
ENV NODE_ENV=production
COPY --chown=node:node backend/ ./backend/
COPY --chown=node:node public/vocabulary/en-vi.json ./public/vocabulary/en-vi.json
COPY --chown=node:node public/vocabulary/english-definitions.json ./public/vocabulary/english-definitions.json
RUN mkdir -p /app/data/custom-decks && chown -R node:node /app/data
COPY --chmod=755 backend/docker-entrypoint.sh /usr/local/bin/project-v-entrypoint
ENTRYPOINT ["project-v-entrypoint"]
EXPOSE 3001
CMD ["node", "backend/server.mjs"]
