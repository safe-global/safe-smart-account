const HDWalletProvider = require('truffle-hdwallet-provider')

const mnemonic = process.env.MNEMONIC
var hdProvider
const getHDProvider = function() {
  if (!hdProvider) hdProvider = new HDWalletProvider(mnemonic, 'https://rinkeby.infura.io/');
  return hdProvider;
}

module.exports = {
  networks: {
    development: {
      host: "localhost",
      port: 8545,
      network_id: "*", // Match any network id
      gas: 6000000
    },
    rinkeby: {
      provider: getHDProvider,
      network_id: '4',
      gas: 6700000,
      gasPrice: 1000000000, // 1 Gwei
    },
    mainnet: {
      provider: getHDProvider,
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
