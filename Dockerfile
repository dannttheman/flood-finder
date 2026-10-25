FROM node:24.15.0-alpine
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
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/api/ready').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node","server.js"]
