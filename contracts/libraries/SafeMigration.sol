// SPDX-License-Identifier: LGPL-3.0-only
/* solhint-disable one-contract-per-file */
pragma solidity >=0.7.0 <0.9.0;

import {SafeStorage} from "../libraries/SafeStorage.sol";
import {ISafe} from "../interfaces/ISafe.sol";

/**
 * @title Migration Contract for Safe Upgrade
 * @notice This is a generic contract that facilitates the migration of a Safe and SafeL2 contracts.
 *         The supported target Safe version codehash is immutable and set in the constructor during the deployment of the contract.
 *         This contract also supports migration with fallback handler update.
 * @author @safe-global/safe-protocol
 * @dev IMPORTANT: The library is intended to be used with the Safe standard proxy that stores the singleton address
 *      at the storage slot 0. Use at your own risk with custom proxy implementations. The contract will allow invocations
 *      to the migration functions only via delegatecall.
 */
contract SafeMigration is SafeStorage {
    /**
     * @notice Address of this contract
     */
    address public immutable MIGRATION_SINGLETON;
    /**
     * @notice Address of the Safe singleton implementation
     */
    address public immutable SAFE_SINGLETON;
    /**
     * @notice Address of the Safe singleton (L2) implementation
     */
    address public immutable SAFE_L2_SINGLETON;
    /**
     * @notice Addresss of the fallbackhandler
     */
    address public immutable SAFE_FALLBACK_HANDLER;

    /**
     * @notice Event indicating a change of master copy address.
     * @param singleton New master copy address
     */
    event ChangedMasterCopy(address singleton);

    /**
     * @notice Modifier to make a function callable via delegatecall only.
     * If the function is called via a regular call, it will revert.
     */
    modifier onlyDelegateCall() {
        require(address(this) != MIGRATION_SINGLETON, "Migration should only be called via delegatecall");
        _;
    }

    /**
     * @notice Constructor
     * @param safeSingleton Address of the Safe singleton implementation
     * @param safeL2Singleton Address of the SafeL2 singleton implementation
     * @param fallbackHandler Address of the fallback handler implmentation
     */
    constructor(address safeSingleton, address safeL2Singleton, address fallbackHandler) {
        MIGRATION_SINGLETON = address(this);

        require(hasCode(safeSingleton), "Safe Singleton is not deployed");
        require(hasCode(safeL2Singleton), "Safe Singleton (L2) is not deployed");
        require(hasCode(fallbackHandler), "fallback handler is not deployed");

        SAFE_SINGLETON = safeSingleton;
        SAFE_L2_SINGLETON = safeL2Singleton;
        SAFE_FALLBACK_HANDLER = fallbackHandler;
    }

    /**
     * @notice Migrate the Safe contract to a new Safe singleton implementation.
     */
    function migrateSingleton() public onlyDelegateCall {
        singleton = SAFE_SINGLETON;
        emit ChangedMasterCopy(SAFE_SINGLETON);
    }

    /**
     * @notice Migrate to Safe Singleton and set the fallback handler. This function is intended to be used when migrating
     *         a Safe to a version which also requires updating fallback handler.
     */
    function migrateWithFallbackHandler() public onlyDelegateCall {
        migrateSingleton();
        ISafe(address(this)).setFallbackHandler(SAFE_FALLBACK_HANDLER);
    }

    /**
     * @notice Migrate the Safe contract to a new Safe singleton implementation.
     *         Checks whether the given target singleton address codehash matches the expected Safe/SafeL2 singleton codehash.
     */
    function migrateL2Singleton() public onlyDelegateCall {
        singleton = SAFE_L2_SINGLETON;
        emit ChangedMasterCopy(SAFE_L2_SINGLETON);
    }

    /**
     * @notice Migrate to Safe Singleton (L2) and set the fallback handler. This function is intended to be used when migrating
     *         a Safe to a version which also requires updating fallback handler.
     */
    function migrateL2WithFallbackHandler() public onlyDelegateCall {
        migrateL2Singleton();
        ISafe(address(this)).setFallbackHandler(SAFE_FALLBACK_HANDLER);
    }

    /**
     * @notice Checks whether an Ethereum address corresponds to a contract or an externally owned account (EOA).
     * @param account The Ethereum address to be checked.
     * @return A boolean value indicating whether the address is associated with a contract (true) or an EOA (false).
     * @dev This function relies on the `extcodesize` assembly opcode to determine whether an address is a contract.
     * It may return incorrect results in some edge cases (see documentation for details).
     * Developers should use caution when relying on the results of this function for critical decision-making.
     */
    function hasCode(address account) internal view returns (bool) {
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
    function getCodeHash(address account) internal view returns (bytes32 codeHash) {
        /* solhint-disable no-inline-assembly */
        /// @solidity memory-safe-assembly
        assembly {
            codeHash := extcodehash(account)
        }
        /* solhint-enable no-inline-assembly */
    }
}
