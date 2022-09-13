FROM node:16.7.0 as builder

WORKDIR /usr/app
COPY . /usr/app

RUN yarn install

ENTRYPOINT ["yarn", "run", "hardhat", "node", "--port", "8545"]

# TODO: introduce second stage (runner)
