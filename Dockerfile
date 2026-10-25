FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --chown=node:node backend/ ./backend/
COPY --chown=node:node public/vocabulary/en-vi.json ./public/vocabulary/en-vi.json
USER node
EXPOSE 3001
CMD ["node", "backend/server.mjs"]
