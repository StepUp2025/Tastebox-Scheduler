FROM node:22-slim

WORKDIR /app
COPY package*.json ./
RUN npm install --force
COPY . .
RUN npm run build
RUN npm prune --omit=dev --force --ignore-scripts
EXPOSE 3000
CMD ["node", "dist/main.js"]
