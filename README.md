Gnosis Safe Contracts
=====================

[![npm version](https://badge.fury.io/js/%40gnosis.pm%2Fsafe-contracts.svg)](https://badge.fury.io/js/%40gnosis.pm%2Fsafe-contracts)
[![Build Status](https://github.com/gnosis/safe-contracts/workflows/safe-contracts/badge.svg?branch=development)](https://github.com/gnosis/safe-contracts/actions)
[![Coverage Status](https://coveralls.io/repos/github/gnosis/safe-contracts/badge.svg?branch=feature/hardhat)](https://coveralls.io/github/gnosis/safe-contracts?branch=feature/hardhat)

Install
-------
### Install requirements with yarn:

```bash
yarn
```

### Run all tests:

```bash
yarn build
yarn test
```

### Deploy Release

Some contracts require that the Solidity compile target is at least `petersburg` (e.g. GnosisSafeProxyFactory and MultiSend). This is default since [Solidity 0.5.5](https://github.com/ethereum/solidity/releases/tag/v0.5.5).

Note: The formal verification was performed using the contract compiled with solcjs 0.5.0.

Preparation:
- Set `MNEMONIC` in `.env`
- Set `INFURA_KEY` in `.env`
- Set `NETWORK` in `.env`

```bash
yarn release
```

### Deploy Local

```bash
yarn build
yarn deploy --network <network>
```

### Verify contract

Note: This is currently not up to date and will be changed before the next release

Note: To completely replicate the bytecode that has been deployed it is required that the project path is `/gnosis-safe` this can be archived using `sudo mkdir /gnosis-safe && sudo mount -B <your_repo_path> /gnosis-safe`. Make sure the run `yarn` again if the path has been changed after the inital `yarn install`. If you use a different path you will only get partial matches.

You can locally verify contract using the scripts `generate_meta.js` and `verify_deployment.js`.

With `node scripts/generate_meta.js` a `meta` folder is created in the `build` folder that contains all files required to verify the source code on https://verification.komputing.org/ and https://etherscan.io/

For Etherscan only the `GnosisSafeEtherscan.json` file is required. For sourcify the `GnosisSafeMeta.json` and all the `.sol` files are required.

Once the meta data has been generated you can verify that your local compiled code corresponds to the version deployed by Gnosis with `yarn do <network> scripts/verify_deployment.js`.

Documentation
-------------
- [Safe developer portal](http://docs.gnosis.io/safe)
- [Coding guidelines](docs/guidelines.md)

Audits/ Formal Verification
---------
- [for Version 1.2.0 by G0 Group](docs/audit_1_2_0.md)
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
