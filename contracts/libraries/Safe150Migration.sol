// SPDX-License-Identifier: LGPL-3.0-only
/* solhint-disable one-contract-per-file */
pragma solidity >=0.7.0 <0.9.0;

import {SafeStorage} from "../libraries/SafeStorage.sol";
import {ISafe} from "../interfaces/ISafe.sol";

/**
 * @title Migration Contract for Safe Upgrade
 * @notice This contract facilitates the migration of a Safe contract from version 1.3.0/1.4.1 to 1.5.0.
 * @dev IMPORTANT: The library is intended to be used with the Safe standard proxy that stores the singleton address
 *      at the storage slot 0. Use at your own risk with custom proxy implementations. The library will block calls
 *      if the address stored at the storage slot 0 is not a contract.
 */
contract Safe150Migration is SafeStorage {
    // Address of Safe contract version 1.5.0 Singleton (L1)
    // TODO: Update this address when the Safe 1.5.0 Singleton is deployed
    address public constant SAFE_150_SINGLETON = address(0x477C3fb2D564349E2F95a2EF1091bF9657b26145);

    // Address of Safe contract version 1.5.0 Singleton (L2)
    // TODO: Update this address when the Safe 1.5.0 Singleton (L2) is deployed
    address public constant SAFE_150_SINGLETON_L2 = address(0x551A2F9a71bF88cDBef3CBe60E95722f38eE0eAA);

    // Address of Safe contract version 1.5.0 Compatibility Fallback Handler
    // TODO: Update this address when the Safe 1.5.0 Compatibility Fallback Handler is deployed
    address public constant SAFE_150_FALLBACK_HANDLER = address(0x4c95c836D31d329d80d696cb679f3dEa028Ad4e5);

    /**
     * @notice Event indicating a change of master copy address.
     * @param singleton New master copy address
     */
    event ChangedMasterCopy(address singleton);

    /**
     * @notice Constructor
     * @dev Initializes the migrationSingleton with the contract's own address.
     */
    constructor() {
        require(isContract(SAFE_150_SINGLETON), "Safe 1.4.1 Singleton is not deployed");
        require(isContract(SAFE_150_SINGLETON_L2), "Safe 1.4.1 Singleton (L2) is not deployed");
        require(isContract(SAFE_150_FALLBACK_HANDLER), "Safe 1.4.1 Fallback Handler is not deployed");
    }

    function checkCurrentSingleton() internal view {
        require(isContract(singleton), "Trying to migrate an invalid Safe");
    }

    modifier validSingletonOnly() {
        checkCurrentSingleton();
        _;
    }

    /**
     * @notice Migrate to Safe 1.5.0 Singleton (L1) at `SAFE_150_SINGLETON`
     * @dev This function should only be called via a delegatecall to perform the upgrade.
     */
    function migrateSingleton() public validSingletonOnly {
        singleton = SAFE_150_SINGLETON;
        emit ChangedMasterCopy(singleton);
    }

    /**
     * @notice Migrate and set the fallback handler to Safe 1.5.0 Compatibility Fallback Handler.
     */
    function migrateWithFallbackHandler() public validSingletonOnly {
        migrateSingleton();

        ISafe(address(this)).setFallbackHandler(SAFE_150_FALLBACK_HANDLER);
    }

    /**
     * @notice Migrate to Safe 1.5.0 Singleton (L2) at `SAFE_150_SINGLETON_L2`
     * @dev This function should only be called via a delegatecall to perform the upgrade.
     */
    function migrateL2Singleton() public validSingletonOnly {
        singleton = SAFE_150_SINGLETON_L2;
        emit ChangedMasterCopy(singleton);
    }

    /**
     * @notice Migrate to Safe 1.5.0 Singleton (L2) and set the fallback handler to Safe 1.5.0 Compatibility Fallback Handler.
     */
    function migrateL2WithFallbackHandler() public validSingletonOnly {
        migrateL2Singleton();

        ISafe(address(this)).setFallbackHandler(SAFE_150_FALLBACK_HANDLER);
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
}
