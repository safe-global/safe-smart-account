const HDWalletProvider = require('truffle-hdwallet-provider')

const mnemonic = process.env.MNEMONIC
const hdProvider = new HDWalletProvider(mnemonic, 'https://rinkeby.infura.io/')

module.exports = {
  networks: {
    development: {
      host: "localhost",
      port: 8545,
      network_id: "*", // Match any network id
      gas: 6000000
    },
    rinkeby: {
      provider: hdProvider,
      network_id: '4',
      gas: 6700000,
      gasPrice: 100000000000, // 1 Gwei
    },
    mainnet: {
      provider: hdProvider,
      network_id: '1',
      gas: 6700000,
      gasPrice: 25000000000, // 25 Gwei
    }
  },
  solc: {
    optimizer: {
      enabled: false
    },
  },
};
