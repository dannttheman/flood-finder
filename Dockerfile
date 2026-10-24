FROM node:22.16-alpine
WORKDIR /app
COPY package.json store.js server.js ./
COPY public ./public
COPY scripts ./scripts
COPY services ./services
RUN mkdir -p /app/data && chown -R node:node /app
USER node
ENV PORT=3000 DATABASE_PATH=/app/data/flood-finder.sqlite
EXPOSE 3000
VOLUME ["/app/data"]
CMD ["node","server.js"]

