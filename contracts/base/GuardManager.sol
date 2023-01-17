// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import "../common/Enum.sol";
import "../common/SelfAuthorized.sol";

interface Guard {
    function checkTransaction(
        address to,
        uint256 value,
        bytes memory data,
        Enum.Operation operation,
        uint256 safeTxGas,
        uint256 baseGas,
        uint256 gasPrice,
        address gasToken,
        address payable refundReceiver,
        bytes memory signatures,
        address msgSender
    ) external;

    function checkAfterExecution(bytes32 txHash, bool success) external;
}

/// @title Fallback Manager - A contract that manages fallback calls made to this contract
/// @author Richard Meissner - <richard@gnosis.pm>
contract GuardManager is SelfAuthorized {

    // TODO: inline
    bytes32 private constant GUARD_LOCK_SLOT = keccak256("guard_manager.guard_lock.struct");
    uint256 private constant GUARD_LOCKED = 2; 
    // Use 1 to keep storage dirty, to reduce gas costs
    uint256 private constant GUARD_UNLOCKED = 1;
    struct GuardLock {
        uint256 state;
    }

    event ChangedGuard(address guard);
    // keccak256("guard_manager.guard.address")
    bytes32 internal constant GUARD_STORAGE_SLOT = 0x4a204f620c8c5ccdca3fd54d003badd85ba500436a431f0cbda4f558c93c34c8;

    /// @dev Set a guard that checks transactions before execution
    /// @param guard The address of the guard to be used or the 0 address to disable the guard
    function setGuard(address guard) external authorized {
        bytes32 slot = GUARD_STORAGE_SLOT;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            sstore(slot, guard)
        }
        emit ChangedGuard(guard);
    }

    function getGuard() internal view returns (address guard) {
        bytes32 slot = GUARD_STORAGE_SLOT;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            guard := sload(slot)
        }
    }

    function getGuardLock() internal pure returns (GuardLock storage lock) {
        bytes32 slot = GUARD_LOCK_SLOT;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            lock.slot := slot
        }
    }

    function checkAndLockGuard() internal {
        GuardLock storage lock = getGuardLock();
        // TODO assign proper error code
        require(lock.state != GUARD_LOCKED, "GSXXX");
        lock.state = GUARD_LOCKED;
    }

    function unlockGuard() internal {
        GuardLock storage lock = getGuardLock();
        // TODO assign proper error code
        require(lock.state == GUARD_LOCKED, "GSXXX");
        lock.state = GUARD_UNLOCKED;
    }
}
