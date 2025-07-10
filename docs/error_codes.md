## Error codes

### General init related
- `GS000`: Could not finish initialization
  - **Why:** Delegatecall to the initializer during setup failed.
  - **How to debug/solve:** Ensure the contract address is correct and does not revert.
- `GS001`: Threshold needs to be defined
  - **Why:** The signature threshold is not set (equals 0) when checking signatures.
  - **How to debug/solve:** Make sure the Safe is properly initialized.
- `GS002`: A call to set up modules couldn't be executed because the destination account was not a contract
  - **Why:** Attempt to initialize a module at an address that is not a contract.
  - **How to debug/solve:** Check that the module address points to a deployed contract.

### General gas/execution related
- `GS010`: Not enough gas to execute Safe transaction
  - **Why:** `execTransaction` was called with insufficient gas.
  - **How to debug/solve:** Increase the gas limit for the transaction.
- `GS011`: Could not pay gas costs with ether
  - **Why:** Payment for gas in ETH failed (e.g., recipient cannot receive ETH).
  - **How to debug/solve:** Ensure the receiver address is correct and can accept ETH.
- `GS012`: Could not pay gas costs with token
  - **Why:** Payment for gas in token failed (e.g., token does not support transfer or returns false).
  - **How to debug/solve:** Check that the token supports the transfer standard and the Safe has enough balance.
- `GS013`: Safe transaction failed when gasPrice and safeTxGas were 0 (Deprecated in v1.5.0)
  - **Why:** Migration or similar function requiring delegatecall was called outside of delegatecall context or with invalid parameters.
  - **How to debug/solve:** Only use supported migration scenarios and ensure the call is made via delegatecall.

### General signature validation related
- `GS020`: Signatures data too short
  - **Why:** Not enough data was provided for signature validation (less than threshold * 65 bytes).
  - **How to debug/solve:** Ensure the number of signatures matches the threshold.
- `GS021`: Invalid contract signature location: inside static part
  - **Why:** The signature offset points inside the static part of the data, not the dynamic part.
  - **How to debug/solve:** Check the signatures are correctly encoded.
- `GS022`: Invalid contract signature location: length not present
  - **Why:** The signature offset is out of bounds (no length for the signature).
  - **How to debug/solve:** Ensure the signature offset does not exceed the array length.
- `GS023`: Invalid contract signature location: data not complete
  - **Why:** The signature data does not fully fit within the signatures array.
  - **How to debug/solve:** Ensure the signature length and offset are correct.
- `GS024`: Invalid contract signature provided
  - **Why:** The contract signer returned an invalid value (not EIP1271_MAGIC_VALUE) during signature validation.
  - **How to debug/solve:** Check that the contract signer implements EIP-1271 and returns the correct value.
- `GS025`: Hash has not been approved
  - **Why:** The transaction hash was not approved by the required number of owners.
  - **How to debug/solve:** Ensure all required owners have signed the transaction or called approveHash.
- `GS026`: Invalid owner provided
  - **Why:** An invalid or duplicate owner was found in the signatures array.
  - **How to debug/solve:** Ensure each owner is unique and valid, and that the signatures are sorted by owner.

### General auth related
- `GS030`: Only owners can approve a hash
  - **Why:** Attempt to approve a hash by a non-owner.
  - **How to debug/solve:** Only owners can call `approveHash`.
- `GS031`: Method can only be called from this contract
  - **Why:** A protected method was called externally instead of via an internal call.
  - **How to debug/solve:** Use only internal calls for functions with the `authorized` modifier.

### Module management related
- `GS100`: Modules have already been initialized
  - **Why:** Attempt to initialize modules more than once.
  - **How to debug/solve:** Module initialization is only allowed once during setup.
- `GS101`: Invalid module address provided
  - **Why:** The module address is invalid (zero or sentinel address).
  - **How to debug/solve:** Ensure the module address is valid and not 0x0 or 0x1.
- `GS102`: Module has already been added
  - **Why:** Attempt to add a module that is already enabled.
  - **How to debug/solve:** Ensure the module was not previously added.
- `GS103`: Invalid prevModule, module pair provided
  - **Why:** The prevModule and module pair do not match when removing a module.
  - **How to debug/solve:** Ensure prevModule actually points to module.
- `GS104`: Method can only be called from an enabled module
  - **Why:** execTransactionFromModule* was called from a non-enabled module.
  - **How to debug/solve:** Ensure the module is added and enabled.
- `GS105`: Invalid starting point for fetching paginated modules
  - **Why:** An invalid start address was provided for module pagination.
  - **How to debug/solve:** Use only valid module addresses or the sentinel address.
- `GS106`: Invalid page size for fetching paginated modules
  - **Why:** The page size for module pagination is zero.
  - **How to debug/solve:** Set pageSize > 0.

### Owner management related
- `GS200`: Owners have already been set up
  - **Why:** Attempt to initialize owners more than once.
  - **How to debug/solve:** Owner initialization is only allowed once during setup.
- `GS201`: Threshold cannot exceed owner count
  - **Why:** The signature threshold exceeds the number of owners.
  - **How to debug/solve:** Set threshold ≤ ownerCount.
- `GS202`: Threshold needs to be greater than 0
  - **Why:** The signature threshold is zero or not set.
  - **How to debug/solve:** Set threshold > 0.
- `GS203`: Invalid owner address provided
  - **Why:** Owner is 0x0, sentinel, the contract itself, or a duplicate.
  - **How to debug/solve:** Ensure owner addresses are unique, not 0x0, not 0x1, and not the Safe address.
- `GS204`: Address is already an owner
  - **Why:** Attempt to add an owner that already exists.
  - **How to debug/solve:** Ensure the owner was not previously added.
- `GS205`: Invalid prevOwner, owner pair provided
  - **Why:** The prevOwner and owner pair do not match when removing or swapping an owner.
  - **How to debug/solve:** Ensure prevOwner actually points to owner.

### Guard management related
- `GS300`: Transaction Guard does not implement IERC165
  - **Why:** Attempt to set a guard that does not implement the ITransactionGuard (IERC165) interface.
  - **How to debug/solve:** Ensure the guard implements the required interface.
- `GS301`: Module Guard does not implement IERC165
  - **Why:** Attempt to set a module guard that does not implement the IModuleGuard (IERC165) interface.
  - **How to debug/solve:** Ensure the module guard implements the required interface.

### Fallback handler related
- `GS400`: Fallback handler cannot be set to self
  - **Why:** Attempt to set the fallback handler to the Safe contract itself.
  - **How to debug/solve:** Use an external contract as the fallback handler.
