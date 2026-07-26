FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app ./
RUN chown -R node:node /app
USER node
EXPOSE 3000
CMD ["sh","-c","npm run db:migrate && npm run db:seed && npm start"]
