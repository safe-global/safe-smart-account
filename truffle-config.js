module.exports = {
  solc: {
    optimizer: {
      enabled: false
    },
    settings: {
      evmVersion: "petersburg"
    }
  },
  networks: {
    development: {
      host: 'localhost',
      port: 8545,
      network_id: '*',
    },
    staging: {
      host: 'api.joincircles.net',
      port: 8545,
      network_id: '*',
    },
    coverage: {
      host: 'localhost',
      network_id: '*',
      port: 8555,
      gas: 0xfffffffffff,
      gasPrice: 0x01,
    },
    ganache: {
      host: 'localhost',
      port: 8545,
      network_id: '*',
    },
  },
};

