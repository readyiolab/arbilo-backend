# Use Node base image
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

ENV NODE_ENV=production
EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:5000/api/health || exit 1

CMD ["node", "index.js"]
