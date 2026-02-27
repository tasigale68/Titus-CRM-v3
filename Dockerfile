FROM node:20-slim

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 3000

# No CMD — Railway sets the start command per service:
#   Web server:  node src/server.js
#   Sync worker: node worker.js
