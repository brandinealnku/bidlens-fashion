FROM mcr.microsoft.com/playwright:v1.54.1-noble
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY server.mjs ./
COPY dist ./dist
ENV NODE_ENV=production PORT=4174
EXPOSE 4174
CMD ["npm", "start"]
