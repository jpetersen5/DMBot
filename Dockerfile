FROM node:22.23.2-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
EXPOSE 3000

CMD ["npm", "run", "dev", "--", "--host"]