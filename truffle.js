const HDWalletProvider = require('truffle-hdwallet-provider')

const mnemonic = process.env.MNEMONIC
const token = process.env.INFURA_TOKEN

module.exports = {
  networks: {
    development: {
      host: "localhost",
      port: 8545,
      network_id: "*" // Match any network id
    },
    rinkeby: {
      provider: () => {
        return new HDWalletProvider(mnemonic, 'https://rinkeby.infura.io/' + token)
      },
      network_id: '4',
      gas: 6700000,
      gasPrice: 1000000000, // 1 Gwei
    },
    mainnet: {
      provider: () => {
        return new HDWalletProvider(mnemonic, 'https://mainnet.infura.io/' + token)
      },
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
