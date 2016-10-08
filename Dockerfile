FROM node:4.3.2

RUN mkdir /api
WORKDIR /api

ADD package.json /api

# Install dependencies
RUN npm install
