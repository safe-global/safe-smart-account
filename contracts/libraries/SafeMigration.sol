// SPDX-License-Identifier: LGPL-3.0-only
/* solhint-disable one-contract-per-file */
pragma solidity >=0.7.0 <0.9.0;

import {SafeStorage} from "../libraries/SafeStorage.sol";

/**
 * @title Migration Contract for Safe Upgrade
 * @notice This is a generic contract that facilitates the migration of a Safe contract.
 *         The supported target Safe version codehash is immutable and set in the constructor during the deployment of the contract.
 *         This contract supports both Safe and SafeL2 contracts.
 * @author @safe-global/safe-protocol
 */
contract SafeMigration is SafeStorage {
    bytes32 public immutable SAFE_SINGLETON_CODE_HASH;
    bytes32 public immutable SAFE_L2_SINGLETON_CODE_HASH;

    /**
     * @notice Event indicating a change of master copy address.
     * @param singleton New master copy address
     */
    event ChangedMasterCopy(address singleton);

    /**
     * @notice Constructor
     * @param safeSingleton Address of the Safe singleton implementation
     * @param safeL2Singleton Address of the SafeL2 singleton implementation
     */
    constructor(address safeSingleton, address safeL2Singleton) {
        require(isContract(safeSingleton), "Safe Singleton is not deployed");
        require(isContract(safeL2Singleton), "Safe Singleton (L2) is not deployed");

        SAFE_SINGLETON_CODE_HASH = getCodehash(safeSingleton);
        SAFE_L2_SINGLETON_CODE_HASH = getCodehash(safeL2Singleton);
    }

    /**
     * @notice Migrate the Safe contract to a new Safe singleton implementation.
     *         Checks whether the given target singleton address codehash matches the expected Safe/SafeL2 singleton codehash.
     * @param target Address of the new Safe singleton implementation.
     */
    function migrateSingleton(address target) external {
        require(getCodehash(target) == SAFE_SINGLETON_CODE_HASH, "Invalid Safe singleton");
        singleton = target;
        emit ChangedMasterCopy(target);
    }

    /**
     * @notice Migrate the Safe contract to a new Safe singleton implementation.
     *         Checks whether the given target singleton address codehash matches the expected Safe/SafeL2 singleton codehash.
     * @param target Address of the new Safe singleton implementation.
     */
    function migrateL2Singleton(address target) external {
        require(getCodehash(target) == SAFE_L2_SINGLETON_CODE_HASH, "Invalid SafeL2 singleton");
        singleton = target;
        emit ChangedMasterCopy(target);
    }

    /**
     * @notice Checks whether an Ethereum address corresponds to a contract or an externally owned account (EOA).
     * @param account The Ethereum address to be checked.
     * @return A boolean value indicating whether the address is associated with a contract (true) or an EOA (false).
     * @dev This function relies on the `extcodesize` assembly opcode to determine whether an address is a contract.
     * It may return incorrect results in some edge cases (see documentation for details).
     * Developers should use caution when relying on the results of this function for critical decision-making.
     */
    function isContract(address account) internal view returns (bool) {
        uint256 size;
        /* solhint-disable no-inline-assembly */
        /// @solidity memory-safe-assembly
        assembly {
            size := extcodesize(account)
        }
        /* solhint-enable no-inline-assembly */

        // If the code size is greater than 0, it is a contract; otherwise, it is an EOA.
        return size > 0;
    }

    /**
     * @notice Get the codehash of an account.
     * @param account The address of the account to get the codehash of
     */
    function getCodehash(address account) private returns (bytes32 codeHash) {
        /* solhint-disable no-inline-assembly */
        /// @solidity memory-safe-assembly
        assembly {
            codeHash := extcodehash(account)
        }
        /* solhint-enable no-inline-assembly */
    }
}
