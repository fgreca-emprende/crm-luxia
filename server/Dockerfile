FROM node:22-alpine

WORKDIR /app

# Copiar archivos de dependencias e instalar
COPY server/package.json ./
RUN npm install --omit=dev

# Copiar código del servidor
COPY server/ ./

EXPOSE 4000

CMD ["node", "index.js"]
