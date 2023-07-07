// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import "../common/Enum.sol";
import "../common/SelfAuthorized.sol";
import "../interfaces/IERC165.sol";

interface Guard is IERC165 {
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

interface ModuleGuard is IERC165 {
    function checkTransaction(address to, uint256 value, bytes memory data, Enum.Operation operation, address module) external;

    function checkAfterExecution(bytes32 txHash, bool success) external;
}

abstract contract BaseGuard is Guard {
    function supportsInterface(bytes4 interfaceId) external view virtual override returns (bool) {
        return
            interfaceId == type(Guard).interfaceId || // 0xe6d7a83a
            interfaceId == type(IERC165).interfaceId; // 0x01ffc9a7
    }
}

/**
 * @title Guard Manager - A contract managing transaction guards which perform pre and post-checks on Safe transactions.
 * @author Richard Meissner - @rmeissner
 */
abstract contract GuardManager is SelfAuthorized {
    event ChangedGuard(address indexed guard, bool moduleGuard);

    // keccak256("guard_manager.guard.address")
    bytes32 internal constant GUARD_STORAGE_SLOT = 0x4a204f620c8c5ccdca3fd54d003badd85ba500436a431f0cbda4f558c93c34c8;

    // keccak256("module_manager.module_guard.address")
    bytes32 internal constant MODULE_GUARD_STORAGE_SLOT = 0xb104e0b93118902c651344349b610029d694cfdec91c589c91ebafbcd0289947;

    /**
     * @dev Set a guard that checks transactions before execution
     *      This can only be done via a Safe transaction.
     *      ⚠️ IMPORTANT: Since a guard has full power to block Safe transaction execution,
     *        a broken guard can cause a denial of service for the Safe. Make sure to carefully
     *        audit the guard code and design recovery mechanisms.
     * @notice Set Transaction Guard `guard` for the Safe. Make sure you trust the guard.
     * @param guard The address of the guard to be used or the 0 address to disable the guard
     * @param moduleGuard true if the guard is a module guard, false if it is a transaction guard
     */
    function setGuard(address guard, bool moduleGuard) external authorized {
        if (guard != address(0)) {
            bytes4 interfaceId = moduleGuard ? type(ModuleGuard).interfaceId : type(Guard).interfaceId;

            require(Guard(guard).supportsInterface(interfaceId), "GS300");
        }
        bytes32 slot = moduleGuard ? MODULE_GUARD_STORAGE_SLOT : GUARD_STORAGE_SLOT;
        // solhint-disable-next-line no-inline-assembly
        /// @solidity memory-safe-assembly
        assembly {
            sstore(slot, guard)
        }
        emit ChangedGuard(guard, moduleGuard);
    }

    /**
     * @dev Internal method to retrieve the current guard
     *      We do not have a public method because we're short on bytecode size limit,
     *      to retrieve the guard address, one can use `getStorageAt` from `StorageAccessible` contract
     *      with the slot `GUARD_STORAGE_SLOT`
     * @return guard The address of the guard
     */
    function getGuard() internal view returns (address guard) {
        bytes32 slot = GUARD_STORAGE_SLOT;
        // solhint-disable-next-line no-inline-assembly
        /// @solidity memory-safe-assembly
        assembly {
            guard := sload(slot)
        }
    }

    function getModuleGuard() internal view returns (address guard) {
        bytes32 slot = MODULE_GUARD_STORAGE_SLOT;
        // solhint-disable-next-line no-inline-assembly
        /// @solidity memory-safe-assembly
        assembly {
            guard := sload(slot)
        }
    }
}
