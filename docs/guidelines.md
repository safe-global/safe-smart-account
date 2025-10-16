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

Note: Make sure to use a unique identifier else unexpected behaviour will occur.

### Code comments

Use only `//` for comments and do not use block comments `/* ... */`. The exception to this rule is to use block comments for Solhint enable/disable directives: `/* solhint-{enable,disable} ... */`. Comments should be sentences: they should start with a capital letter and end with a dot.

### NatSepc

Use `/** */` for NatSpec comments and not `///`. Additionally, we use a non-standard notation for referencing symbols in a NatSpec documentation: `{someSymbol}` is a reference to the symbol (function, storage, constant, etc.) `someSymbol`.
