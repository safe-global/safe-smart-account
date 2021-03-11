// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import "../common/SelfAuthorized.sol";

/// @title Fallback Manager - A contract that manages fallback calls made to this contract
/// @author Richard Meissner - <richard@gnosis.pm>
contract GuardManager is SelfAuthorized {
    // keccak256("guard_manager.guard.address")
    // TODO: update
    bytes32 internal constant GUARD_STORAGE_SLOT =
        0x7c9a6c4a39284e37ed1cf53d337577d14212a4870fb976a4366c693b939917d5;

    function internalSetGuard(address handler) internal {
        bytes32 slot = GUARD_STORAGE_SLOT;
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            sstore(slot, handler)
        }
    }

    /// @dev Set a guard that checks transactions before execution
    /// @param guard The address of the guard to be used or the 0 address to disable the guard
    function setGuard(address guard)
        external
        authorized
    {
        internalSetGuard(guard);
    }

    function checkCalldata() internal {
        bytes32 slot = GUARD_STORAGE_SLOT;
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            let guard := sload(slot)
            if not(iszero(guard)) {
                // Load free memory location
                let ptr := mload(0x40)
                // We do not set the position as we throw away this data after this method call anyways
                // therefore it can be overwritten
                calldatacopy(ptr, 0, calldatasize())
                // The msg.sender address is shifted to the left by 12 bytes to remove the padding
                // Then the address without padding is stored right after the calldata
                mstore(add(calldatasize(), ptr), shl(96, caller()))
                // Add 20 bytes for the address appended add the end
                let success := call(
                    gas(),
                    guard,
                    0,
                    ptr,
                    add(calldatasize(), 20),
                    0,
                    0
                )
                returndatacopy(0, 0, returndatasize())
                if iszero(success) {
                    revert(0, returndatasize())
                }
            }
        }
    }
}
