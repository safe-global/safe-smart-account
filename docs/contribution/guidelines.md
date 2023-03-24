## Coding Guidelines

### Declaration of variables

New variables will use a hash based storage approach to avoid conflicts in the storage layout of the proxy contract when updating the master copy.

For this a variable identifier should be defined (e.g. `fallback_manager.handler.address` for the handler address in the fallback manager contract) and hash this identifier to generate the storage location from where the data should be loaded.

The data can be stored to this location with

```
bytes32 slot = VARIABLE_SLOT;
// solhint-disable-next-line no-inline-assembly
assembly {
    sstore(slot, value)
}
```

and read with

```
bytes32 slot = VARIABLE_SLOT;
// solhint-disable-next-line no-inline-assembly
assembly {
    value := sload(slot)
}
```

Note: Make sure to use a unique identifier else unexpected behaviour will occur

### Error Codes

As Solidity 0.7.5 does not support custom errors, to minimize the bytecodesize of the contracts and still provide meaningful insights [error codes](../architecture/error_codes.md) should be used.

When creating a new error code ensure that it is in the correct section and if possible provide a way how to resolve the error in the docs.

### Code comments

Use `/** */` for multiline comments and `//` for single-line comments.

The comment should start with a capital letter and end with a dot.
