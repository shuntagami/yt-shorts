# syntax = docker/dockerfile:1.4

FROM node:20-slim

WORKDIR /workspace/app

COPY package*.json ./

RUN npm ci

# COPY . .
COPY src ./src

RUN npm run build

CMD ["npm", "run", "dev"]
