Gnosis Safe Contracts
=====================

[![npm version](https://badge.fury.io/js/%40gnosis.pm%2Fsafe-contracts.svg)](https://badge.fury.io/js/%40gnosis.pm%2Fsafe-contracts)
[![Build Status](https://travis-ci.org/gnosis/safe-contracts.svg?branch=development)](https://travis-ci.org/gnosis/safe-contracts)

Install
-------
### Install requirements with npm:

```bash
npm install
```

### Run all tests (requires Node version >=7 for `async/await`):

```bash
npx truffle compile
npx truffle test
```

### Deploy

Some contracts require that the Solidity compile target is `petersburg` (e.g. ProxyFactory and MultiSend). This is default since [Solidity 0.5.5](https://github.com/ethereum/solidity/releases/tag/v0.5.5).

Note: The formal verification was performed using the contract compiled with solcjs 0.5.0.

Preparation:
```bash
export MNEMONIC="<mnemonic>"
```

OpenZeppelin SDK:
- Make sure that @openzeppelin/cli is version 2.5
- Make sure that all dependencies use solcjs >0.5.0
- Add `txParams['from'] = txParams['from'] || web3.currentProvider.getAddress(0)` in `Transactions.js` of the `@openzeppelin/upgrades` module

```bash
node scripts/deploy_safe_contracts_oz.js
```

Truffle:

```bash
npx truffle deploy
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
solidity_flattener contracts/libraries/MultiSend.sol --output build/flattened_contracts/MultiSend.sol --solc-paths="/=/"
solidity_flattener contracts/modules/DailyLimitModule.sol --output build/flattened_contracts/DailyLimitModule.sol --solc-paths="/=/"
solidity_flattener contracts/modules/SocialRecoveryModule.sol --output build/flattened_contracts/SocialRecoveryModule.sol --solc-paths="/=/"
solidity_flattener contracts/modules/StateChannelModule.sol --output build/flattened_contracts/StateChannelModule.sol --solc-paths="/=/"
solidity_flattener contracts/modules/WhitelistModule.sol --output build/flattened_contracts/WhitelistModule.sol --solc-paths="/=/"
solidity_flattener contracts/proxies/ProxyFactory.sol --output build/flattened_contracts/ProxyFactory.sol
find build/flattened_contracts -name '*.sol' -exec sed -i '' 's/pragma solidity ^0.4.13;/pragma solidity ^0.5.0;/g' {} \;
```

Using with OpenZeppelin SDK
---------------------

You can create a gnosis safe upgradeable instance using [OpenZeppelin SDK](https://docs.openzeppelin.com/sdk/2.5) by linking to the provided [EVM package](https://docs.openzeppelin.com/sdk/2.5/linking). This will use the master copy already deployed to mainnet, kovan, or rinkeby, reducing gas deployment costs. 

To create an instance using OpenZeppelin SDK:

```bash
$ npm install -g @openzeppelin/sdk
$ oz init YourProject
$ oz link @gnosis.pm/safe-contracts
$ oz push --network rinkeby
> Connecting to dependency @gnosis.pm/safe-contracts 1.0.0
$ oz create @gnosis.pm/GnosisSafe --init setup --args "[$ADDRESS1,$ADDRESS2,$ADDRESS3],2,0x0000000000000000000000000000000000000000,\"\"" --network rinkeby --from $SENDER
> Instance created at SAFE_ADDRESS
```

Documentation
-------------
- [ReadTheDocs](http://gnosis-safe.readthedocs.io/en/latest/)
- [Coding guidlines](docs/guidelines.md)

Audits/ Formal Verification
---------
- [by Runtime Verification](docs/rv_1_0_0.md)
- [by Alexey Akhunov](docs/alexey_audit.md)

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
