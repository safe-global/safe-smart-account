# Safe Contract implementation properties

## Reminder on property categories

The categories are based on Certora's workshop [notes](https://github.com/Certora/Tutorials/blob/40ad7970bfafd081f6f416fe36b31981e48c6857/3DayWorkshop/SymbolicPool/properties.md).

1. Valid states
   Usually, there can be only one valid state at any given time. Such properties ensure the system is always in exactly one of its valid states.

2. State transitions
   Such properties verify the correctness of transactions between valid states. E.g., confirm valid states change according to their correct order or transitions only occur under the right conditions.

3. Variable transitions
   Similar to state transitions, but for variables. E.g., verify that Safe nonce is monotonically increasing.

4. High-level properties
   The most powerful type of properties covering the entire system. E.g., for any given operation, Safe threshold must remain lower or equal to the number of owners.

5. Unit test
   Such properties target specific function individually to verify their correctness. E.g., verify that a specific function can only be called by a specific address.

6. Risk assessment
   Such properties verify that worst cases that can happen to the system are handled correctly. E.g., verify that a transaction cannot be replayed.

## Safe Contract Properties

Verification doesn't hold for the `DELEGATECALL` operation.

### Valid states

### State transitions

### Variable transitions

### High-level properties

### Unit test

### Risk assessment

-   nonce monotonicity, it can only increase by 1 after execTransaction call

-   consistency of owner and module lists

verify that `ownerCount` is in sync with the linked list.
always circular - each address for which `isModuleEnabled` returns true should be a part of the list

-   configuration changes to safe can only be done by the safe
    who can swap owner?
    module management
    who should be able to?

who should be allowed to make contract do delegate calls?
contract creator
address specified by contract creator

-   setup only be done once

module states
enabled
cancelled

execTransactionFromModuleReturnData
