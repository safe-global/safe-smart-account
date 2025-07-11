# Changelog

This changelog only contains changes starting from version 1.3.0

# Current version

## Changes

None.

# Version 1.5.0

## Compiler settings

Solidity compiler: [0.7.6](https://github.com/ethereum/solidity/releases/tag/v0.7.6) (for more info see issue [#251](https://github.com/safe-global/safe-smart-account/issues/251))

Solidity optimizer: `disabled`

## Expected addresses with [Safe Singleton Factory](https://github.com/safe-global/safe-singleton-factory)

### Core contracts

| Contract Name | Address                                      |
| ------------- | -------------------------------------------- |
| `Safe`        | `0xFf51A5898e281Db6DfC7855790607438dF2ca44b` |
| `SafeL2`      | `0xEdd160fEBBD92E350D4D398fb636302fccd67C7e` |

### Factory contracts

| Contract Name      | Address                                      |
| ------------------ | -------------------------------------------- |
| `SafeProxyFactory` | `0x14F2982D601c9458F93bd70B218933A6f8165e7b` |

### Handler contracts

| Contract Name                  | Address                                      |
| ------------------------------ | -------------------------------------------- |
| `TokenCallbackHandler`         | `0x54e86d004d71a8D2112ec75FaCE57D730b0433F3` |
| `CompatibilityFallbackHandler` | `0x3EfCBb83A4A7AfcB4F68D501E2c2203a38be77f4` |
| `ExtensibleFallbackHandler`    | `0x85a8ca358D388530ad0fB95D0cb89Dd44Fc242c3` |

### Lib contracts

| Contract Name                                   | Address                                      |
| ----------------------------------------------- | -------------------------------------------- |
| `CreateCall`                                    | `0x2Ef5ECfbea521449E4De05EDB1ce63B75eDA90B4` |
| `MultiSend`                                     | `0x218543288004CD07832472D464648173c77D7eB7` |
| `MultiSendCallOnly`                             | `0xA83c336B20401Af773B6219BA5027174338D1836` |
| `SignMessageLib`                                | `0x4FfeF8222648872B3dE295Ba1e49110E61f5b5aa` |
| `SafeToL2Setup`                                 | `0x900C7589200010D6C6eCaaE5B06EBe653bc2D82a` |
| `SafeMigration` (target Safe version: `v1.5.0`) | `0x6439e7ABD8Bb915A5263094784C5CF561c4172AC` |

### Storage reader contracts

| Contract Name        | Address                                      |
| -------------------- | -------------------------------------------- |
| `SimulateTxAccessor` | `0x07EfA797c55B5DdE3698d876b277aBb6B893654C` |

## Changes

### General

#### Deprecate zkSync EraVM Support

PR: [#1004](https://github.com/safe-global/safe-smart-account/pull/1004)

ZkSync and zkSync based chains now have a full EVM compatibility layer. Starting from Safe v1.5.0, all deployments will be EVM only and will no longer support EraVM versions of Safe. Note that EraVM contracts cannot `DELEGATECALL` EVM contracts, which means that Safes created with EraVM cannot upgrade to Safe v1.5.0+ and instead need to be migrated.

#### Deprecate `SafeToL2Migration`

PR: [#1008](https://github.com/safe-global/safe-smart-account/pull/1008)

`SafeToL2Migration` was used as a solution to help make Safes that were deployed with an L1 singleton compatible with the transaction service and wallet interface on networks where only the L2 singleton is supported. It _only_ allowed migrations from a Safe singleton to another with the same version. Since the wallet interface now deploys all Safes with the `SafeToL2Setup` contract, all 1.5.0 Safes are expected to be deployed in a cross-chain compatible way, and this contract is no longer necessary. A new contract that supports migrating Safes with older L1 singletons to the latest L2 singleton may be introduced in the future.

#### Rename repository

Issue: [#719](https://github.com/safe-global/safe-smart-account/issues/719)

The repository was renamed from `safe-contracts` to `safe-smart-account` to reflect the contracts' purpose better. The npm package name was also changed from `@safe-global/safe-contracts` to `@safe-global/safe-smart-account`.

#### Introduce Extensible Fallback Handler

PR: [#851](https://github.com/safe-global/safe-smart-account/pull/851)

The `ExtensibleFallbackHandler`, originally created by the CoWSwap Team, is used to bring new features and capabilities to Safe Smart Account, including swaps, TWAP orders, etc. More details can be found [here](https://cow.fi/learn/all-you-need-to-know-about-cow-swap-new-safe-fallback-handler).

**NOTE**: The events for adding and removing Safe methods and domain verifiers were simplified such that contracts only emit a "changed" event. This is a breaking change from the original implementation from the CoW Swap team.

#### Event emitted with `initializer` and `saltNonce` for proxy creation

PR: [849](https://github.com/safe-global/safe-smart-account/pull/849)

An extra set of functions which includes an event which mentions the `initializer` and `saltNonce` is introduced for better indexing for networks which lack advanced tracing facilities.

#### Internal revert message propagation

Issue: [#715](https://github.com/safe-global/safe-smart-account/issues/715)

Implementation of error propagation for internal TX so the user/dev can know the reason for revert instead of generic `GS013`.

#### Use the updated EIP-1271 function signature in the signature validation process

Issue: [#391](https://github.com/safe-global/safe-smart-account/issues/391)

A new function signature was implemented, and the legacy function was removed from the compatibility fallback handler contract.

#### Remove usage of `transfer` and `send`

Issue: [#601](https://github.com/safe-global/safe-smart-account/issues/601)

Calls to `transfer` and `send` were removed to ensure the contract did not depend on potential gas cost changes. They were replaced with `call`, and that should be kept in mind when using the contract and designing extensions due to potential reentrancy vectors.

#### Make assembly blocks memory-safe

Issue: [#544](https://github.com/safe-global/safe-smart-account/issues/544)

The contracts couldn't be compiled with the solidity compiler versions 0.8.19+ because of the compiler optimizations that copy stack variables to memory to prevent stack-too-deep errors. Scratch space was used in some assembly blocks, but that's not considered safe, so all the assembly blocks were adjusted to use safe memory allocation.

#### Add module guard interface

Issue: [#758](https://github.com/safe-global/safe-smart-account/issues/758)

The `IModuleGuard` interface was added to check the module transactions before and after execution.

#### Add overloaded `checkNSignatures` method

Issues:

- [#557](https://github.com/safe-global/safe-smart-account/pull/557)
- [#589](https://github.com/safe-global/safe-smart-account/pull/589)

Previously, pre-approved signatures relying on the `msg.sender` variable couldn't be used in guards or modules without duplicating the logic within the module itself. This is now improved by adding an overloaded `checkNSignatures` method that accepts a `msg.sender` parameter. This allows the module to pass the `msg.sender` variable to the `checkNSignatures` method and use the pre-approved signatures. The old method was moved from the core contract to the `CompatibilityFallbackHandler`.

#### Remove `encodeTransactionData` and add inline-assembly-based encoding in `getTransactionHash`

PR: [#603](https://github.com/safe-global/safe-smart-account/pull/603)

Since the last release, the `encodeTransactionData` function has been refactored in two stages. Due to bytecode size constraints, it was initially modified in PR [#603](https://github.com/safe-global/safe-smart-account/pull/603) to a `private` function. Subsequently, in PR [#847](https://github.com/safe-global/safe-smart-account/pull/847), `encodeTransactionData` was entirely removed and replaced with an optimized, inline-assembly implementation within the `getTransactionHash` function. Note that `encodeTransactionData` was added to the `CompatibilityFallbackHandler` for backwards compatibility.

#### Deprecate `createProxyWithCallback`

PR: [#955](https://github.com/safe-global/safe-smart-account/pull/955)

The `createProxyWithCallback` function on the `SafeProxyFactory` was removed, as it was unused and the current implementation did not guarantee that the `callback` would get called.

# Version 1.4.1

## Release iterations

- 1.4.1-2: Added `SafeToL2Migration`, `SafeMigration` and `SafeToL2Setup` contracts to facilitate migrations from previous Safe versions.
- 1.4.1-3: Added zkSync support for all contracts.

## Compiler settings

Solidity compiler: [0.7.6](https://github.com/ethereum/solidity/releases/tag/v0.7.6) (for more info see issue [#251](https://github.com/safe-global/safe-smart-account/issues/251))

Solidity optimizer: `disabled`

ZK Settings: zksolc version [1.5.3](https://github.com/matter-labs/era-compiler-solidity/releases/tag/1.5.3)

## Expected addresses with [Safe Singleton Factory](https://github.com/safe-global/safe-singleton-factory)

### Core contracts

| Contract Name | EVM                                          | ZKSync                                       |
| ------------- | -------------------------------------------- | -------------------------------------------- |
| `Safe`        | `0x41675C099F32341bf84BFc5382aF534df5C7461a` | `0xC35F063962328aC65cED5D4c3fC5dEf8dec68dFa` |
| `SafeL2`      | `0x29fcB43b46531BcA003ddC8FCB67FFE91900C762` | `0x610fcA2e0279Fa1F8C00c8c2F71dF522AD469380` |

### Factory contracts

| Contract Name      | EVM                                          | ZKSync                                       |
| ------------------ | -------------------------------------------- | -------------------------------------------- |
| `SafeProxyFactory` | `0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67` | `0xc329D02fd8CB2fc13aa919005aF46320794a8629` |

### Handler contracts

| Contract Name                  | EVM                                          | ZKSync                                       |
| ------------------------------ | -------------------------------------------- | -------------------------------------------- |
| `TokenCallbackHandler`         | `0xeDCF620325E82e3B9836eaaeFdc4283E99Dd7562` | `0xd508168Db968De1EBc6f288322e6C820137eeF79` |
| `CompatibilityFallbackHandler` | `0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99` | `0x9301E98DD367135f21bdF66f342A249c9D5F9069` |

### Lib contracts

| Contract Name                                   | EVM                                          | ZKSync                                       |
| ----------------------------------------------- | -------------------------------------------- | -------------------------------------------- |
| `MultiSend`                                     | `0x38869bf66a61cF6bDB996A6aE40D5853Fd43B526` | `0x309D0B190FeCCa8e1D5D8309a16F7e3CB133E885` |
| `MultiSendCallOnly`                             | `0x9641d764fc13c8B624c04430C7356C1C7C8102e2` | `0x0408EF011960d02349d50286D20531229BCef773` |
| `CreateCall`                                    | `0x9b35Af71d77eaf8d7e40252370304687390A1A52` | `0xAAA566Fe7978bB0fb0B5362B7ba23038f4428D8f` |
| `SignMessageLib`                                | `0xd53cd0aB83D845Ac265BE939c57F53AD838012c9` | `0xAca1ec0a1A575CDCCF1DC3d5d296202Eb6061888` |
| `SafeMigration` (Target Safe version: `v1.4.1`) | `0x526643F69b81B008F46d95CD5ced5eC0edFFDaC6` | `0x817756C6c555A94BCEE39eB5a102AbC1678b09A7` |
| `SafeToL2Migration`                             | `0xfF83F6335d8930cBad1c0D439A841f01888D9f69` | `0xa26620d1f8f1a2433F0D25027F141aaCAFB3E590` |
| `SafeToL2Setup`                                 | `0xBD89A1CE4DDe368FFAB0eC35506eEcE0b1fFdc54` | `0x199A9df0224031c20Cc27083A4164c9c8F1Bcb39` |

### Storage reader contracts

| Contract Name        | EVM                                          | ZKSync                                       |
| -------------------- | -------------------------------------------- | -------------------------------------------- |
| `SimulateTxAccessor` | `0x3d4BA2E0884aa488718476ca2FB8Efc291A46199` | `0xdd35026932273768A3e31F4efF7313B5B7A7199d` |

## Changes

### General

#### New contracts

Issue: [#787](https://github.com/safe-global/safe-smart-account/issues/787)

The `SafeMigration` contract is a generalized migration contract that facilitates Safe migrations. The contract takes target singleton and fallback handler addresses as its constructor argument.

PR: [#759](https://github.com/safe-global/safe-smart-account/pull/759)

The `SafeToL2Setup` contract facilitates the deployment of a Safe to the same address on all networks by automatically changing the singleton to the L2 version when it is not on chain ID 1.

PR: [#685](https://github.com/safe-global/safe-smart-account/pull/685)

The `SafeToL2Migration` contract facilitates updating a Safe from 1.1.1/1.3.0/1.4.1 versions to an L2 version. This is useful when replaying a Safe from a non-L2 network in an L2 network.

### Bugfixes

#### Remove `gasleft()` usage in `setupModules`

Issue: [#568](https://github.com/safe-global/safe-smart-account/issues/568)

`setupModules` made a call to `gasleft()` that is invalid in the ERC-4337 standard. The call was replaced with `type(uint256).max` to forward all the available gas instead.

# Version 1.4.0

## Compiler settings

Solidity compiler: [0.7.6](https://github.com/ethereum/solidity/releases/tag/v0.7.6) (for more info see issue [#251](https://github.com/safe-global/safe-smart-account/issues/251))

Solidity optimizer: `disabled`

## Expected addresses with [Safe Singleton Factory](https://github.com/safe-global/safe-singleton-factory)

### Core contracts

- `Safe` at `0xc962E67D9490E154D81181879ddf4CD3b65D2132`
- `SafeL2` at `0x1eb4681c549d995AbdC4aB189cAbb9f00B508cAb`

### Factory contracts

- `SafeProxyFactory` at `0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67`

### Handler contracts

- `TokenCallbackHandler` at `0xeDCF620325E82e3B9836eaaeFdc4283E99Dd7562`
- `CompatibilityFallbackHandler` at `0x2a15DE4410d4c8af0A7b6c12803120f43C42B820`

### Lib contracts

- `MultiSend` at `0x38869bf66a61cF6bDB996A6aE40D5853Fd43B526`
- `MultiSendCallOnly` at `0x9641d764fc13c8B624c04430C7356C1C7C8102e2`
- `CreateCall` at `0x9b35Af71d77eaf8d7e40252370304687390A1A52`
- `SignMessageLib` at `0x58FCe385Ed16beB4BCE49c8DF34c7d6975807520`

### Storage reader contracts

- `SimulateTxAccessor` at `0x3d4BA2E0884aa488718476ca2FB8Efc291A46199`

## Changes

### General

#### Drop "Gnosis" from contract names

Removed the "Gnosis" prefix from all contract names.

### Core contract

File: [`contracts/SafeL2.sol`](https://github.com/safe-global/safe-smart-account/blob/3c3fc80f7f9aef1d39aaae2b53db5f4490051b0d/contracts/SafeL2.sol)

#### Remove usage of the `GAS` opcode in module execute flows

Issue: [#459](https://github.com/safe-global/safe-smart-account/issues/459)

The following rule of usage of the `GAS` opcode in the ERC-4337 standard made it impossible to build a module to support ERC4337:

> - Must not use GAS opcode (unless followed immediately by one of { CALL, DELEGATECALL, CALLCODE, STATICCALL }.)

We removed the `GAS` opcode usage in module transactions to forward all the available gas instead.

#### Require the `to` address to be a contract in `setupModules`

Issue: [#483](https://github.com/safe-global/safe-smart-account/issues/483)

The `setupModules` method was changed to require the `to` address to be a contract. The transaction will revert with a `GS002` error code if the `to` address is not a contract.

#### Enforce the `dataHash` is equal to `data` in the signature verification process for contract signatures

Issue: [#497](https://github.com/safe-global/safe-smart-account/issues/497)

To prevent unexpected behaviour, the `dataHash` must now equal a hash of the `data` in the signature verification process for contract signatures. Otherwise, the transaction will revert with a `GS027` error code.

#### Fix `getModulesPaginated` to return a correct `next` pointer

Issue: [#461](https://github.com/safe-global/safe-smart-account/issues/461)

The `getModulesPaginated` method was fixed to return a correct `next` pointer. The `next` pointer now equals the last module in the returned array.

#### Check the EIP-165 signature of the Guard before adding

Issue: [#309](https://github.com/safe-global/safe-smart-account/issues/309)

The core contract checks that the target address supports the Guard interface with an EIP-165 check when setting a guard. If it doesn't, the transaction will revert with the `GS300` error code.

#### Index essential parameters when emitting events

Issue: [#541](https://github.com/safe-global/safe-smart-account/issues/541)

Index essential parameters in the essential events, such as:

- Owner additions and removals (Indexed parameter - owner address)
- Fallback manager changes (Indexed parameter - fallback manager address)
- Module additions and removals (Indexed parameter - module address)
- Transaction guard changes (Indexed parameter - guard address)
- Transaction execution/failure (Indexed parameter - transaction hash)

### Factory

Umbrella issue: [#462](https://github.com/safe-global/safe-smart-account/issues/462)

#### Remove the `createProxy` method

This method uses the `CREATE` opcode, which is not counterfactual for a specific deployment. This caused user errors and lost/stuck funds and is now removed.

#### Add a check that singleton exists for the initializer call

If the initializer data is provided, the Factory will now check that the Singleton contract exists and that the call succeeded in avoiding the deployment of an uninitialized proxy.

#### Add `createChainSpecificProxyWithNonce`

This method will use the chain ID in the `CREATE2` salt; therefore, deploying a proxy to the same address on other networks is impossible.
This method should enable the creation of proxies that should exist only on one network (e.g. specific governance or admin accounts)

#### Remove the `calculateProxyAddress` method

The method uses the revert approach to return data, which only works well with some nodes, as they all return messages differently. Hence, we removed it, and the off-chain CREATE2 calculation is still possible.

#### Remove the `proxyRuntimeCode` method

The `.runtimeCode` method is not supported by the ZkSync compiler, so we removed it.

### Fallback handlers

Files:

- [CompatibilityFallbackHandler.sol](https://github.com/safe-global/safe-smart-account/blob/3c3fc80f7f9aef1d39aaae2b53db5f4490051b0d/contracts/handler/CompatibilityFallbackHandler.sol)
- [TokenCallbackHandler](https://github.com/safe-global/safe-smart-account/blob/3c3fc80f7f9aef1d39aaae2b53db5f4490051b0d/contracts/handler/TokenCallbackHandler.sol)

#### Rename `DefaultCallbackHandler` to `TokenCallbackHandler`

Since the `DefaultCallbackHandler` only handled token callbacks, it was renamed to `TokenCallbackHandler`.

#### Remove `NAME` and `VERSION` constants

The `NAME` and `VERSION` constants were removed from the `CompatibilityFallbackHandler` contract.

#### Fix function signature mismatch for `isValidSignature`

Issue: [#440](https://github.com/safe-global/safe-smart-account/issues/440)

Fixed mismatch between the function signature in the `isValidSignature` method and the `ISignatureValidator` interface.

### Libraries

#### CreateCall

File: [`contracts/libraries/CreateCall.sol`](https://github.com/safe-global/safe-smart-account/blob/3c3fc80f7f9aef1d39aaae2b53db5f4490051b0d/contracts/libraries/CreateCall.sol)

#### Index the created contract address in the `ContractCreation` event

Issue: [#541](https://github.com/safe-global/safe-smart-account/issues/541)

The deployed contract address in the `ContractCreation` event is now indexed.

### Deployment process

#### Use the Safe Singleton Factory for all deployments

Issue: [#460](https://github.com/safe-global/safe-smart-account/issues/460)

Deployments with the [Safe Singleton Factory](https://github.com/safe-global/safe-singleton-factory) are now the default deployment process to ensure the same addresses on all chains.

# Version 1.3.0-libs.0

## Compiler settings

Solidity compiler: [0.7.6](https://github.com/ethereum/solidity/releases/tag/v0.7.6) (more info see issue [#251](https://github.com/safe-global/safe-smart-account/issues/251))

Solidity optimizer: `disabled`

## Expected addresses with [Deterministic Deployment Proxy](https://github.com/Arachnid/deterministic-deployment-proxy) (default)

### Core contracts

- `GnosisSafe` at `0xd9Db270c1B5E3Bd161E8c8503c55cEABeE709552`
- `GnosisSafeL2` at `0x3E5c63644E683549055b9Be8653de26E0B4CD36E`

### Factory contracts

- `GnosisSafeProxyFactory` at `0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2`

### Handler contracts

- `DefaultCallbackHandler` at `0x1AC114C2099aFAf5261731655Dc6c306bFcd4Dbd`
- `CompatibilityFallbackHandler` at `0xf48f2B2d2a534e402487b3ee7C18c33Aec0Fe5e4`

### Lib contracts

- `MultiSend` at `0xA238CBeb142c10Ef7Ad8442C6D1f9E89e07e7761`
- `MultiSendCallOnly` at `0x40A2aCCbd92BCA938b02010E17A5b8929b49130D`
- `CreateCall` at `0x7cbB62EaA69F79e6873cD1ecB2392971036cFAa4`
- `SignMessageLib` at `0xA65387F16B013cf2Af4605Ad8aA5ec25a2cbA3a2`

### Storage reader contracts

- `SimulateTxAccessor` at `0x59AD6735bCd8152B84860Cb256dD9e96b85F69Da`

## Expected addresses with [Safe Singleton Factory](https://github.com/safe-global/safe-singleton-factory)

### Core contracts

- `GnosisSafe` at `0x69f4D1788e39c87893C980c06EdF4b7f686e2938`
- `GnosisSafeL2` at `0xfb1bffC9d739B8D520DaF37dF666da4C687191EA`

### Factory contracts

- `GnosisSafeProxyFactory` at `0xC22834581EbC8527d974F8a1c97E1bEA4EF910BC`

### Handler contracts

- `DefaultCallbackHandler` at `0x3d8E605B02032A941Cfe26897Ca94d77a5BC24b3`
- `CompatibilityFallbackHandler` at `0x017062a1dE2FE6b99BE3d9d37841FeD19F573804`

### Lib contracts

- `MultiSend` at `0x998739BFdAAdde7C933B942a68053933098f9EDa`
- `MultiSendCallOnly` at `0xA1dabEF33b3B82c7814B6D82A79e50F4AC44102B`
- `CreateCall` at `0xB19D6FFc2182150F8Eb585b79D4ABcd7C5640A9d`
- `SignMessageLib` at `0x98FFBBF51bb33A056B08ddf711f289936AafF717`

### Storage reader contracts

- `SimulateTxAccessor` at `0x727a77a074D1E6c4530e814F89E618a3298FC044`

## Changes

### Deployment process

To support deployment to networks that require replay protection, support for the [Safe Singleton Factory](https://github.com/safe-global/safe-singleton-factory) has been added. This will result in an additional set of deterministic addresses listed above.

### Libraries

The following libraries have been marked as production-ready.

#### SignMessageLib

File: [`contracts/libraries/SignMessageLib.sol`](https://github.com/safe-global/safe-smart-account/blob/e57df14ea96dc7dabf93f041c7531f2ab6755c76/contracts/libraries/SignMessageLib.sol)

Expected behaviour:

The library is a compatibility tool for the removed `signMessage` function from the pre-1.3.0 Safe contracts. It has the same signature and assumes the same storage layout as the previous Safe contract versions. After calling this function with a message, the hash of that message should be marked as executed in the `signedMessages` mapping.

#### GnosisSafeStorage

File: [`contracts/libraries/GnosisSafeStorage.sol`](https://github.com/safe-global/safe-smart-account/blob/e57df14ea96dc7dabf93f041c7531f2ab6755c76/contracts/libraries/GnosisSafeStorage.sol)

Expected behaviour:

The contract contains the basic storage layout of the `GnosisSafe.sol` contract and can be used by library contracts to access the storage variables.

# Version 1.3.0

## Compiler settings

Solidity compiler: [0.7.6](https://github.com/ethereum/solidity/releases/tag/v0.7.6) (more info see issue [#251](https://github.com/safe-global/safe-smart-account/issues/251))

Solidity optimizer: `disabled`

## Expected deterministic deployment addresses

### Core contracts

- `GnosisSafe` at `0xd9Db270c1B5E3Bd161E8c8503c55cEABeE709552`
- `GnosisSafeL2` at `0x3E5c63644E683549055b9Be8653de26E0B4CD36E`

### Factory contracts

- `GnosisSafeProxyFactory` at `0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2`

### Handler contracts

- `DefaultCallbackHandler` at `0x1AC114C2099aFAf5261731655Dc6c306bFcd4Dbd`
- `CompatibilityFallbackHandler` at `0xf48f2B2d2a534e402487b3ee7C18c33Aec0Fe5e4`

### Lib contracts

- `MultiSend` at `0xA238CBeb142c10Ef7Ad8442C6D1f9E89e07e7761`
- `MultiSendCallOnly` at `0x40A2aCCbd92BCA938b02010E17A5b8929b49130D`
- `CreateCall` at `0x7cbB62EaA69F79e6873cD1ecB2392971036cFAa4`

### Storage reader contracts

- `SimulateTxAccessor` at `0x59AD6735bCd8152B84860Cb256dD9e96b85F69Da`

## Changes

### Core contract

File: [`contracts/GnosisSafe.sol`](https://github.com/safe-global/safe-smart-account/blob/ad6c7355d5bdf4f7fa348fbfcb9f07431769a3c9/contracts/GnosisSafe.sol)

#### Add chainId to transaction hash

Issue: [#170](https://github.com/safe-global/safe-smart-account/issues/170)

Expected behaviour:

The `chainId` has been added to the [EIP-712](https://eips.ethereum.org/EIPS/eip-712) domain. In case of a change of the `chainId` (e.g. hardfork related), the new `chainId` will automatically be used for future signature checks.

#### Add transaction guard

Issue: [#224](https://github.com/safe-global/safe-smart-account/issues/224)

Expected behaviour:

It is possible to add a transaction guard to check all parameters sent to `execTransaction` before execution. For this check, the `checkTransaction` needs to be implemented by the Guard. In case that `checkTransaction` reverts, `execTransaction` will also revert. Another check that the Guard can implement is `checkAfterExecution`. This check is called at the very end of the execution and allows us to perform checks on the final state of the Safe. The parameters passed to that check are the `safeTxHash` and a `success` boolean.

#### Add StorageAccessible support

Issue: [#201](https://github.com/safe-global/safe-smart-account/issues/201)

Expected behaviour:

It is possible to use `simulateDelegatecallInternal` to simulate logic on the Safe by providing a contract and calldata. This contract will then be called via a delegatecall and the result will be returned via a revert. The revert data will have the following format:
`success:bool || response.length:uint256 || response:bytes`.

Important: This method will always revert.

#### Remove changeMasterCopy

Expected behaviour:

It is not possible anymore to change the singleton address (formerly known as master copy) via a method call. To make the implications of a singleton address change more visible, a delegatecall with a migration contract is required. (See example migration in libraries)

#### Make checkSignature public

Issue: [#248](https://github.com/safe-global/safe-smart-account/issues/248)

Expected behaviour:

The `checkSignature` method is now a public view method. This allows it to be used in other contracts (e.g., modules) to reuse existing signature check logic. The function expects that there are at least enough valid signatures to hit the threshold.
Another method added to facilitate the use of external contracts is `checkNSignatures`, which allows you to set the expected number of valid signatures.
Note: The storage allocated by `approveHash` will no longer be zeroed when used in `checkSignature`. If this is required, a delegatecall with a contract that zeroes past approved hashes should be used.

#### Remove authorized from requiredTxGas

Issue: [#247](https://github.com/safe-global/safe-smart-account/issues/247)

Expected behaviour:

To make it easier to interact with this method (e.g., by providing a wrapper), the requirement that the method can only be called by the Safe itself has been removed. The method will still always revert.
Note: The `StorageAccessible` logic supersedes this method and will be removed in the next major version.

#### Move EIP-1271 logic to the fallback handler

Issue: [#223](https://github.com/safe-global/safe-smart-account/issues/223)

Expected behaviour:

As [EIP-1271](https://eips.ethereum.org/EIPS/eip-1271) is still changing, its logic has been moved to a fallback handler. The fallback handler uses the `checkSignatures` method to validate the signatures. Also, this fallback handler supports the latest version of [EIP-1271](https://eips.ethereum.org/EIPS/eip-1271). The logic to mark a message hash as signed in the contract has also been moved to other contracts. `getMessageHash` has been moved to a fallback handler, and `signMessage` has been moved into a library that can be used via delegatecall.
Note: The `checkSignature` method still uses the previous version of [EIP-1271](https://eips.ethereum.org/EIPS/eip-1271) that uses the data to be signed instead of the hash of the data.

#### Send along msg.sender to the fallback handler

Issue: [#246](https://github.com/safe-global/safe-smart-account/issues/246)

Expected behaviour:

When the Safe forwards a call to the fallback handler, it will append the `msg.sender` to the calldata. This will allow the fallback handler to use this information.
Note: Fallback handlers should make sure that the connected Safe supports this, else this can be used by the caller to influence the fallback handler (by specifying an arbitrary `msg.sender`)

#### Revert on failure if safeTxGas and gasPrice are 0

Issue: [#274](https://github.com/safe-global/safe-smart-account/issues/274)

Expected behaviour:

If `safeTxGas` is 0 (all available gas has been used for the internal transaction) and `gasPrice` is 0 (no refund is involved), the transaction will revert when the internal transaction fails. This makes it easier to interact with the Safe without having to estimate the internal transaction ahead of time.

#### Add setup event

Issue: [#233](https://github.com/safe-global/safe-smart-account/issues/233)

Expected behaviour:

The Safe now emits an event that contains all setup information that influences the state of the nearly setup Safe. The initializer calldata is omitted to prevent excessive gas costs. The refund information is omitted as it doesn't influence the state of the internal contract.

#### Add incoming ETH event

Issue: [#209](https://github.com/safe-global/safe-smart-account/issues/209)

Expected behaviour:

When the Safe receives ETH, it will trigger an event (except ETH received via a call to `execTransaction` or due to another contract's self-destruct).
Note: It will not be possible anymore to send ETH via the solidity calls transfer or send it to a Safe. This is expected to break because of the gas costs changes with the Berlin hard fork ([EIP-2929](https://eips.ethereum.org/EIPS/eip-2929)) in any case (even without the event) when using the legacy transaction format. As there is also a new transaction format ([EIP-2930](https://eips.ethereum.org/EIPS/eip-2930)) it is possible to use that together with the correct access list to still execute transfer/ send calls and emit the event.

### Layer 2

#### Add contract version that emits Safe tx information via events

File: [`contracts/GnosisSafeL2.sol`](https://github.com/safe-global/safe-smart-account/blob/ad6c7355d5bdf4f7fa348fbfcb9f07431769a3c9/contracts/GnosisSafeL2.sol)

Expected behaviour:

The extended version will emit an event with all the information related to the Safe transaction that will be executed. As this is quite gas-expensive, this version is only expected to be used on Layer 2 networks with low gas prices.
The events are expected to be emitted upon entry into the method. The normal Safe methods emit some events after the execution of the Safe transaction. This will make it possible to connect other events to that call as they are "boxed" by the GnosisSafeL2 events and the GnosisSafe events.

Example:

On entry into `execTransaction` of the `GnosisSafeL2` contract, a `SafeMultiSigTransaction` event will be emitted that contains all the parameters of the function and the `nonce`, `msg.sender` and `threshold`. Once the internal execution has finished, the `execTransaction` of the `GnosisSafe` contract will emit an `ExecutionSuccess` or `ExecutionFailure` event. When processing the events of that transaction, connecting all events emitted between these two events to this specific Safe transaction is possible.
The same can be done with the `SafeModuleTransaction` and `ExecutionFromModuleSuccess` (or `ExecutionFromModuleFailure`) events when executing a transaction via a module.

### Fallback handlers

#### Add EIP-165 support to DefaultCallbackHandler

Issue: [#161](https://github.com/safe-global/safe-smart-account/issues/161)

File: [`contracts/handler/DefaultCallbackHandler.sol`](https://github.com/safe-global/safe-smart-account/blob/ad6c7355d5bdf4f7fa348fbfcb9f07431769a3c9/contracts/handler/DefaultCallbackHandler.sol)

Expected behaviour:

Indicate via the `supportsInterface` method of [EIP-165](https://eips.ethereum.org/EIPS/eip-165) that the [EIP-721](https://eips.ethereum.org/EIPS/eip-721) and [EIP-1155](https://eips.ethereum.org/EIPS/eip-1155) receiver interfaces are supported.

#### Add CompatibilityFallbackHandler

Issue: [#223](https://github.com/safe-global/safe-smart-account/issues/223)

File: [`contracts/handler/CompatibilityFallbackHandler.sol`](https://github.com/safe-global/safe-smart-account/blob/ad6c7355d5bdf4f7fa348fbfcb9f07431769a3c9/contracts/handler/CompatibilityFallbackHandler.sol)

Expected behaviour:

The `CompatibilityFallbackHandler` extends the `DefaultCallbackHandler` and implements support for some logic removed from the core contracts. Namely, [EIP-1271](https://eips.ethereum.org/EIPS/eip-1271) support and the non-reverting method of the `StorageAccessible` contract. Also, the fallback manager contains the logic to verify Safe messages.

#### Add possibility to get sender in fallback handler

File: [`contracts/handler/HandlerContext.sol`](https://github.com/safe-global/safe-smart-account/blob/ad6c7355d5bdf4f7fa348fbfcb9f07431769a3c9/contracts/handler/HandlerContext.sol)

Expected behaviour:

The `HandlerContext` can retrieve the `msg.sender` and the Safe (aka manager) that have been forwarding the call to the fallback handler. The `msg.sender` is expected to be appended to the calldata (e.g. last 20 bytes). This will only work if used with a Safe contract that supports this (e.g. 1.3.0 or newer).

### Guard

#### Add DelegateCallTransactionGuard

File: [`contracts/examples/guards/DelegateCallTransactionGuard.sol`](https://github.com/safe-global/safe-smart-account/blob/ad6c7355d5bdf4f7fa348fbfcb9f07431769a3c9/contracts/examples/guards/DelegateCallTransactionGuard.sol)

Note: **This contract is meant as an example to demonstrate how to facilitate a guard. This should not be used in production without further checks.**

Expected behaviour:

This transaction guard can prevent Safe transactions that use a delegate call operation from being executed. When deploying the contract, an exception (e.g., a `MultiSendCallOnly` instance) can be specified.

#### Add DebugTransactionGuard

File: [`contracts/examples/guards/DebugTransactionGuard.sol`](https://github.com/safe-global/safe-smart-account/blob/ad6c7355d5bdf4f7fa348fbfcb9f07431769a3c9/contracts/examples/guards/DebugTransactionGuard.sol)

Note: **This contract is meant as an example to demonstrate how to facilitate a guard. This should not be used in production without further checks.**

Expected behaviour:

This transaction guard can be used to log more details about a transaction. This is similar to what the L2 version of the Safe does but is implemented as a transaction guard. One event containing the transaction details will be emitted, and another will be used to track the status of a specific nonce.

#### Add ReentrancyTransactionGuard

File: [`contracts/examples/guards/ReentrancyTransactionGuard.sol`](https://github.com/safe-global/safe-smart-account/blob/ad6c7355d5bdf4f7fa348fbfcb9f07431769a3c9/contracts/examples/guards/ReentrencyTransactionGuard.sol)

Note: **This contract is meant as an example to demonstrate how to facilitate a guard. This should not be used in production without further checks.**

Expected behaviour:

This transaction guard can be used to prevent that Safe transactions can re-enter the `execTransaction` method. The transaction guard does not differentiate between different Safes, so if multiple Safes use the same guard instance it prevents reentrancy in all of the connected Safes.

### Libraries

#### Make multiSend payable to avoid check on msg.value

Issue: [#227](https://github.com/safe-global/safe-smart-account/issues/227)

File: [`contracts/libraries/MultiSend.sol`](https://github.com/safe-global/safe-smart-account/blob/ad6c7355d5bdf4f7fa348fbfcb9f07431769a3c9/contracts/libraries/MultiSend.sol)

Expected behaviour:

The `multiSend` is now payable; therefore, it will no longer enforce that the `msg.value` is 0. ETH that is not transferred out again will remain in `this` (the calling contract when used via a delegatecall or the contract when used via call, only possible with `MultiSendCallOnly`)

#### Add MultiSend that disallows delegate operation

File: [`contracts/libraries/MultiSendCallOnly.sol`](https://github.com/safe-global/safe-smart-account/blob/ad6c7355d5bdf4f7fa348fbfcb9f07431769a3c9/contracts/libraries/MultiSendCallOnly.sol)

Expected behaviour:

The logic is the same as for the normal `MultiSend`, but the contract will revert when an attempt is made to execute a transaction via a delegatecall.
Note: The encoding of the data sent to the `multiSend` method is exactly the same as for the normal `MultiSend`. This makes it easy to exchange the contracts depending on the use case.

#### Add base contract for Safe storage layout

File: [`contracts/examples/libraries/GnosisSafeStorage.sol`](https://github.com/safe-global/safe-smart-account/blob/ad6c7355d5bdf4f7fa348fbfcb9f07431769a3c9/contracts/examples/libraries/GnosisSafeStorage.sol)

Note: **This contract is meant as an example to demonstrate how to access the Safe state within a library contract. This should not be used in production without further checks.**

Expected behaviour:

The contract contains the basic storage layout of the `GnosisSafe.sol` contract.

#### Add contract to mark Safe messages as signed

File: [`contracts/examples/libraries/SignMessage.sol`](https://github.com/safe-global/safe-smart-account/blob/ad6c7355d5bdf4f7fa348fbfcb9f07431769a3c9/contracts/examples/libraries/SignMessage.sol)

Note: **This contract is meant as an example to demonstrate how to mark a Safe message as signed in the signedMessages mapping. This should not be used in production without further checks.**

Expected behaviour:

The library is a compatibility tool for the removed `signMessage` function from the pre-1.3.0 Safe contracts. It has the same signature and assumes the same storage layout as the previous Safe contract versions. After calling this function with a message, the hash of that message should be marked as executed in the `signedMessages` mapping.

#### Add Migration example to downgrade from 1.3.0 to 1.2.0

File: [`contracts/examples/libraries/Migrate_1_3_0_to_1_2_0.sol`](https://github.com/safe-global/safe-smart-account/blob/ad6c7355d5bdf4f7fa348fbfcb9f07431769a3c9/contracts/examples/libraries/Migrate_1_3_0_to_1_2_0.sol)

Note: **This contract is meant as an example to demonstrate how to facilitate migration in the future. This should not be used in production without further checks.**

Expected behaviour:

This migration can be used to migrate a Safe to another singleton address. Once the migration has been executed, the singleton address will point to the address specified in the constructor of the migration, and the domain separator will be properly set in storage (as this is required by the 1.2.0 version of the Safe contracts).
Note: This is an example contract to be used in production only if you know what you're doing.
