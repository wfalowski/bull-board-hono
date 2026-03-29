FROM node:22-alpine3.21

WORKDIR /app

COPY package.json ./
RUN npm install --ignore-scripts

COPY index.js ./

CMD ["node", "index.js"]
