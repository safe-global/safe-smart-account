Gnosis Safe Contracts
=====================

[![npm version](https://badge.fury.io/js/%40gnosis.pm%2Fsafe-contracts.svg)](https://badge.fury.io/js/%40gnosis.pm%2Fsafe-contracts)
[![Build Status](https://travis-ci.org/gnosis/safe-contracts.svg?branch=development)](https://travis-ci.org/gnosis/safe-contracts)

Install
-------
### Install requirements with yarn:

```bash
yarn
```

### Run all tests (requires Node version >=7 for `async/await`):

```bash
yarn truffle compile
yarn test
```

`yarn test` will start a ganache-cli with the correct configuration. If you want to run `yarn truffle test` you need to start a [ganache-cli](https://github.com/trufflesuite/ganache-cli) instance. For this it is required to use the [`--noVMErrorsOnRPCResponse`](https://github.com/trufflesuite/ganache-cli#options) option. This option will make sure that ganache-cli behaves the same as other clients (e.g. geth and parity) when handling reverting calls to contracts. This is required as some flows parse the error message (see https://gnosis-safe.readthedocs.io/en/latest/contracts/transactions.html#safe-transaction-gas-limit-estimation).

### Deploy

Some contracts require that the Solidity compile target is at least `petersburg` (e.g. GnosisSafeProxyFactory and MultiSend). This is default since [Solidity 0.5.5](https://github.com/ethereum/solidity/releases/tag/v0.5.5).

Note: The formal verification was performed using the contract compiled with solcjs 0.5.0.

Preparation:
- Set `INFURA_TOKEN` in `.env`
- Set `NETWORK` in `.env`
- Run `yarn truffle compile`

Truffle:
- Set `MNEMONIC` in `.env`

```bash
yarn truffle deploy
```

Verify Contracts:
- requires installed solc (>0.5.0)
```bash
virtualenv env -p python3
. env/bin/activate
pip install solidity-flattener
mkdir build/flattened_contracts
solidity_flattener contracts/GnosisSafe.sol --output build/flattened_contracts/GnosisSafe.sol
solidity_flattener contracts/libraries/CreateAndAddModules.sol --output build/flattened_contracts/CreateAndAddModules.sol --solc-paths="/=/"
solidity_flattener contracts/libraries/CreateCall.sol --output build/flattened_contracts/CreateCall.sol --solc-paths="/=/"
solidity_flattener contracts/libraries/MultiSend.sol --output build/flattened_contracts/MultiSend.sol --solc-paths="/=/"
solidity_flattener contracts/handler/DefaultCallbackHandler.sol --output build/flattened_contracts/DefaultCallbackHandler.sol --solc-paths="/=/"
solidity_flattener contracts/modules/DailyLimitModule.sol --output build/flattened_contracts/DailyLimitModule.sol --solc-paths="/=/"
solidity_flattener contracts/modules/SocialRecoveryModule.sol --output build/flattened_contracts/SocialRecoveryModule.sol --solc-paths="/=/"
solidity_flattener contracts/modules/StateChannelModule.sol --output build/flattened_contracts/StateChannelModule.sol --solc-paths="/=/"
solidity_flattener contracts/modules/WhitelistModule.sol --output build/flattened_contracts/WhitelistModule.sol --solc-paths="/=/"
solidity_flattener contracts/proxies/GnosisSafeProxyFactory.sol --output build/flattened_contracts/GnosisSafeProxyFactory.sol
find build/flattened_contracts -name '*.sol' -exec sed -i '' 's/pragma solidity ^0.4.13;/pragma solidity >=0.5.0 <0.7.0;/g' {} \;
```

### Verify contract

You can locally verify contract using the scripts `generate_meta.js` and `verify_deployment.js`.

With `node generate_meta.js` a `meta` folder is created in the `build` folder that contains all files required to verify the source code on https://verification.komputing.org/ 

One the the meta data has been generated you can verify that your local compiled code corresponds to the deployed version by running `node verify_deployment.js`. 
Note: For this it is required that the project path is `/gnosis-safe` this can be archived using `sudo mount -B <your_repo_path> gnosis-safe`.

Documentation
-------------
- [Safe developer portal](http://docs.gnosis.io/safe)
- [Coding guidlines](docs/guidelines.md)

Audits/ Formal Verification
---------
- [for Version 1.1.1 by G0 Group](docs/audit_1_1_1.md)
- [for Version 1.0.0 by Runtime Verification](docs/rv_1_0_0.md)
- [for Version 0.0.1 by Alexey Akhunov](docs/alexey_audit.md)

Security and Liability
----------------------
All contracts are WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.

License
-------
All smart contracts are released under LGPL v.3.

Contributors
------------
- Stefan George ([Georgi87](https://github.com/Georgi87))
- Richard Meissner ([rmeissner](https://github.com/rmeissner))
- Christian Lundkvist ([christianlundkvist](https://github.com/christianlundkvist))
- Nick Dodson ([SilentCicero](https://github.com/SilentCicero))
- Gonçalo Sá ([GNSPS](https://github.com/GNSPS))
