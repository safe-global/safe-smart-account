Gnosis Safe Contracts
=====================

The Gnosis Safe is a multisignature wallet with support for confirmations using signed messages based on [ERC191](https://github.com/ethereum/EIPs/issues/191). It is the successor of the [Gnosis Multisig Wallet](https://github.com/gnosis/MultiSigWallet) and combines more functionality with reduced gas costs. The Gnosis Safe allows basic wallet configuration like adding and removing owners and more advanced features like extensions, which allow to do transactions with different requirements.

Contracts
---------
### Gnosis Safe Transactions
A Safe transaction has the same parameters as a regular Ethereum transaction: A destination address, an Ether value and a data payload as a bytes array. In addition, Safe transactions have two more parameters: `operation` and `nonce`.

The operation type specifies if the transaction is executed as a `CALL`, `DELEGATECALL` or `CREATE` operation. While most wallet contracts only support `CALL` operations, adding `DELEGATECALL` operations allows to enhance the functionality of the wallet without updating the wallet code. As a `DELEGATCALL` is executed in the context of the wallet contract, it can potentially mutate the state of the wallet (like changing owners) and therefore can only be used with known, trusted contracts. The `CREATE` operation allows to create new contracts with bytecode sent from the wallet itself.

The nonce prevents replay attacks and is increased with every successfully executed Safe transaction. The number of executed Safe transactions is therefore equal to the current nonce saved in the wallet storage.

### Contract Creations
As the creation of new contracts is a very gas consuming operation, Safe contracts use a proxy pattern where only one master copy of a contract is deployed once and all its copies are deployed as minimal proxy contracts pointing to the master copy contract. This pattern also allows to update the contract functionality later on by updating the address of the master copy in the proxy contract. As contract constructors can only be executed once at the time the master copy is deployed, constructor logic has to be moved into an additional persistent setup function, which can be called to setup all copies of the master copy. This setup function has to be implemented in a way it can only be executed once. It is important to note that the master copy contract has to be persistent and there should be no possibility to execute a `selfdestruct` call on the master copy contract.

#### Proxy.sol
The proxy contract implements only two functions: The constructor setting the address of the master copy and the fallback function forwarding all transactions sent to the proxy via a `DELEGATECALL` to the master copy and returning all data returned by the `DELEGATECALL`.

#### ProxyFactory.sol
The proxy factory allows to create new proxy contracts pointing to a master copy and executing a function in the newly deployed proxy in one transaction. This additional transaction can for example execute the setup function to initialize the state of the contract.

### Gnosis Safe
#### GnosisSafe.sol
The Gnosis Safe contract implements all basic multisignature functionality. It allows to execute Safe transactions and Safe extensions.

Safe transactions can be used to configure the wallet like managing owners, updating the master copy address or whitelisting of extensions. All configuration functions can only be called via transactions sent from the Safe itself. This assures that configuration changes require owner confirmations.

Before a Safe transaction can be executed, the transaction has to be confirmed by the required number of owners. Owners represented by private key controlled accounts can sign the transaction hash.

Once the required number of confirmations is available `executeTransaction` can be called with the sending confirmation signatures.

`executeTransaction` expects all confirmations sorted by owner address. This is required to easily validate no confirmation duplicates exist.

##### Example execution

Assuming we have 2 owners in a 2 out of 2 multisig configuration:

1. `0x1` (Private key)
2. `0x2` (Private key)

`0x1` and `0x2` are confirming by signing a message.

The Safe transaction parameters used for `executeTransaction` have to be set like the following:
* `v = [v_0x1, v_0x2]`
* `r = [r_0x1, r_0x2]`
* `s = [s_0x1, s_0x2]`

`v`, `r` and `s` are the signature parameters for the signed confirmation messages. Position `0` in `v` represents `0x1`'s signature part and corresponds to position `0` in `r` and `s`.

### Extensions
Extensions allow to execute transactions from the Safe without the requirement of multiple signatures. For this Extensions that have been added to a Safe can use the `executeExtension` function. Extensions define their own requirements for execution. Extensions need to implement their own replay protection.

#### DailyLimitExtension.sol
The Daily Limit Extensions allows an owner to withdraw specified amounts of specified ERC20 tokens on a daily basis without confirmation by other owners. The daily limit is reset at midnight UTC. Ether is represented with the token address 0. Daily limits can be set via Safe transactions.

#### SocialRecoveryExtension.sol
The Social Recovery Extensions allows to recover a Safe in case access to owner accounts was lost. This is done by defining a minimum of 3 friends’ addresses as trusted parties. If all required friends confirm that a Safe owner should be replaced with another address, the Safe owner is replaced and access to the Safe can be restored. Every owner address can be replaced only once.

#### WhitelistExtension.sol
The Whitelist Extensions allows an owner to execute arbitrary transactions to specific addresses without confirmation by other owners. The whitelist can be maintained via Safe transactions.

### Libraries
Libraries can be called from the Safe via a `DELEGATECALL`. They should not implement their own storage as this storage won’t be accessible via a `DELEGATECALL`.

#### MultiSend.sol
This library allows to batch transactions and execute them at once. This is useful if user interactions require more than one transaction for one UI interaction like approving an amount of ERC20 tokens and calling a contract consuming those tokens. If one transaction fails all are reverted.

#### CreateAndAddExtension.sol
This library allows to create a new Safe extension and whitelist this extension for the Safe in one single transaction.

Install
-------
### Install requirements with npm:

```bash
npm install
```

### Run all tests (requires Node version >=7 for `async/await`):

```bash
truffle test
```

### Deploy

```bash
truffle deploy
```

Security and Liability
----------------------
All contracts are WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.

License
-------
All smart contracts are released under GPL v.3.

Contributors
------------
- Stefan George ([Georgi87](https://github.com/Georgi87))
- Christian Lundkvist ([christianlundkvist](https://github.com/christianlundkvist))
- Nick Dodson ([SilentCicero](https://github.com/SilentCicero))
- Gonçalo Sá ([GNSPS](https://github.com/GNSPS))
- Richard Meissner ([rmeissner](https://github.com/rmeissner))

Reviewers
---------
The code has not been reviewed yet.
