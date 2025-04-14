## Coding Guidelines

### Declaration of variables

New variables will use a hash based storage approach to avoid conflicts in the storage layout of the proxy contract when updating the master copy.

For this, a variable identifier should be defined (e.g. `fallback_manager.handler.address` for the handler address in the fallback manager contract) and hash this identifier to generate the storage location from where the data should be loaded.

The data can be stored in this location with

```
bytes32 slot = VARIABLE_SLOT;
/* solhint-disable no-inline-assembly */
/// @solidity memory-safe-assembly
assembly {
    sstore(slot, value)
}
/* solhint-enable no-inline-assembly */
```

and read with

```
bytes32 slot = VARIABLE_SLOT;
/* solhint-disable no-inline-assembly */
/// @solidity memory-safe-assembly
assembly {
    value := sload(slot)
}
/* solhint-enable no-inline-assembly */
```

Note: Make sure to use a unique identifier else unexpected behaviour will occur

### Code comments

Use only `//` for comments and do not use block comments `/* ... */`. The exception to this rule is to use block comments comments for Solhint enable/disable directives: `/* solhint-{enable,disable} ... */`. Comments should be sentences: they should start with a capital letter and end with a dot.

### NatSepc

Use `/** */` for NatSpec comments and not `///`. Additionally, we use a non-standard notation for referencing symbols in a NatSpec documentation: `{someSymbol}` is a reference to the symbol (function, storage, constant, etc.) `someSymbol`.

#### NatSpec proofreading

We are manually reviewing the NatSpec documentation to make sure there aren't any inconsistencies. Here is the "TODO" list:

- [x] Safe.sol
- [x] SafeL2.sol
- [x] accessors/SimulateTxAccessor.sol
- [x] base/Executor.sol
- [x] base/FallbackManager.sol
- [x] base/GuardManager.sol
- [x] base/ModuleManager.sol
- [x] base/OwnerManager.sol
- [ ] common/NativeCurrencyPaymentFallback.sol
- [ ] common/SecuredTokenTransfer.sol
- [ ] common/SelfAuthorized.sol
- [ ] common/SignatureDecoder.sol
- [ ] common/Singleton.sol
- [ ] common/StorageAccessible.sol
- [ ] external/SafeMath.sol
- [ ] handler/CompatibilityFallbackHandler.sol
- [ ] handler/ExtensibleFallbackHandler.sol
- [ ] handler/HandlerContext.sol
- [ ] handler/TokenCallbackHandler.sol
- [ ] handler/extensible/ERC165Handler.sol
- [ ] handler/extensible/ExtensibleBase.sol
- [ ] handler/extensible/FallbackHandler.sol
- [ ] handler/extensible/MarshalLib.sol
- [ ] handler/extensible/SignatureVerifierMuxer.sol
- [ ] handler/extensible/TokenCallbacks.sol
- [ ] interfaces/ERC1155TokenReceiver.sol
- [ ] interfaces/ERC721TokenReceiver.sol
- [ ] interfaces/ERC777TokensRecipient.sol
- [ ] interfaces/IERC165.sol
- [ ] interfaces/IFallbackManager.sol
- [ ] interfaces/IGuardManager.sol
- [ ] interfaces/IModuleManager.sol
- [ ] interfaces/IOwnerManager.sol
- [x] interfaces/ISafe.sol
- [ ] interfaces/ISignatureValidator.sol
- [ ] interfaces/ViewStorageAccessible.sol
- [ ] libraries/CreateCall.sol
- [ ] libraries/Enum.sol
- [ ] libraries/ErrorMessage.sol
- [ ] libraries/MultiSend.sol
- [ ] libraries/MultiSendCallOnly.sol
- [ ] libraries/SafeMigration.sol
- [ ] libraries/SafeStorage.sol
- [ ] libraries/SafeToL2Migration.sol
- [ ] libraries/SafeToL2Setup.sol
- [ ] libraries/SignMessageLib.sol
- [ ] proxies/IProxyCreationCallback.sol
- [ ] proxies/SafeProxy.sol
- [ ] proxies/SafeProxyFactory.sol
