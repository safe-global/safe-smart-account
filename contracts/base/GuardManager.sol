// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import "../common/SelfAuthorized.sol";

interface Guard {
    function checkCalldata(bytes calldata data, address sender) external;
}

/// @title Fallback Manager - A contract that manages fallback calls made to this contract
/// @author Richard Meissner - <richard@gnosis.pm>
contract GuardManager is SelfAuthorized {
    // keccak256("guard_manager.guard.address")
    bytes32 internal constant GUARD_STORAGE_SLOT =
        0x4a204f620c8c5ccdca3fd54d003badd85ba500436a431f0cbda4f558c93c34c8;

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
        address guard;
        assembly {
            guard := sload(slot)
        }
        if (guard != address(0)) {
            Guard(guard).checkCalldata(msg.data, msg.sender);
        }
    }
}
