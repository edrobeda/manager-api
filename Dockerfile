FROM node:20-alpine

# Instalar cliente PostgreSQL para pg_dump e psql
RUN apk add --no-cache postgresql-client

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3004

CMD ["npm", "start"]
