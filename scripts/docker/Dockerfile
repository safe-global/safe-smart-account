FROM node:12

ENV USER=root
WORKDIR "/"

COPY ./package.json ./yarn.lock ./hardhat.config.ts ./

RUN yarn

COPY . .

RUN yarn build