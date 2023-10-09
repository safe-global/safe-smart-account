// SPDX-License-Identifier: LGPL-3.0-only
/* solhint-disable one-contract-per-file */
pragma solidity >=0.7.0 <0.9.0;

import {SafeStorage} from "../libraries/SafeStorage.sol";
import {Guard} from "../base/GuardManager.sol";

// Interface for interacting with the Safe contract
interface ISafe {
    function setFallbackHandler(address handler) external;

    function setGuard(address guard) external;
}

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
    address public constant SAFE_150_SINGLETON = address(0x88627c8904eCd9DF96A572Ef32A7ff13b199Ed8D);

    // Address of Safe contract version 1.5.0 Singleton (L2)
    // TODO: Update this address when the Safe 1.5.0 Singleton (L2) is deployed
    address public constant SAFE_150_SINGLETON_L2 = address(0x0Ee37514644683f7EB9745a5726C722DeBa77e52);

    // Address of Safe contract version 1.5.0 Compatibility Fallback Handler
    // TODO: Update this address when the Safe 1.5.0 Compatibility Fallback Handler is deployed
    address public constant SAFE_150_FALLBACK_HANDLER = address(0x8aa755cB169991fEDC3E306751dCb71964A041c7);

    // the slot is defined as "keccak256("guard_manager.guard.address")" in the GuardManager contract
    // reference: https://github.com/safe-global/safe-contracts/blob/8ffae95faa815acf86ec8b50021ebe9f96abde10/contracts/base/GuardManager.sol#L76-L77
    bytes32 internal constant GUARD_STORAGE_SLOT = 0x4a204f620c8c5ccdca3fd54d003badd85ba500436a431f0cbda4f558c93c34c8;

    /**
     * @notice Constructor
     * @dev Initializes the migrationSingleton with the contract's own address.
     */
    constructor() {
        require(isContract(SAFE_150_SINGLETON), "Safe 1.4.1 Singleton is not deployed");
        require(isContract(SAFE_150_SINGLETON_L2), "Safe 1.4.1 Singleton (L2) is not deployed");
        require(isContract(SAFE_150_FALLBACK_HANDLER), "Safe 1.4.1 Fallback Handler is not deployed");
    }

    /**
     * @notice Event indicating a change of master copy address.
     * @param singleton New master copy address
     */
    event ChangedMasterCopy(address singleton);

    /**
     * @dev Private function to check if a guard is supported.
     */
    function checkGuard() private view {
        address guard = getGuard();

        if (guard != address(0)) {
            require(Guard(guard).supportsInterface(type(Guard).interfaceId), "GS300");
        }
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
        checkGuard();

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
     * @notice Migrate and set the guard to the specified address.
     * @param guard The address of the new guard contract.
     */
    function migrateWithSetGuard(address guard) public validSingletonOnly {
        singleton = SAFE_150_SINGLETON;
        emit ChangedMasterCopy(singleton);

        ISafe(address(this)).setGuard(guard);
    }

    /**
     * @notice Migrate, set the guard to the specified address, and set the fallback handler to Safe 1.5.0 Compatibility Fallback Handler.
     * @param guard The address of the new guard contract.
     */
    function migrateWithSetGuardAndFallbackHandler(address guard) public validSingletonOnly {
        migrateWithSetGuard(guard);

        ISafe(address(this)).setFallbackHandler(SAFE_150_FALLBACK_HANDLER);
    }

    /**
     * @notice Migrate to Safe 1.5.0 Singleton (L2) at `SAFE_150_SINGLETON_L2`
     * @dev This function should only be called via a delegatecall to perform the upgrade.
     */
    function migrateL2Singleton() public validSingletonOnly {
        checkGuard();

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
     * @notice Migrate to Safe 1.5.0 Singleton (L2) and set the guard to the specified address.
     * @param guard The address of the new guard contract.
     */
    function migrateL2WithSetGuard(address guard) public validSingletonOnly {
        singleton = SAFE_150_SINGLETON_L2;
        emit ChangedMasterCopy(singleton);

        ISafe(address(this)).setGuard(guard);
    }

    /**
     * @notice Migrate to Safe 1.5.0 Singleton (L2), set the guard to the specified address, and set the fallback handler to Safe 1.5.0 Compatibility Fallback Handler.
     * @param guard The address of the new guard contract.
     */
    function migrateL2WithSetGuardAndFallbackHandler(address guard) public validSingletonOnly {
        migrateL2WithSetGuard(guard);

        ISafe(address(this)).setFallbackHandler(SAFE_150_FALLBACK_HANDLER);
    }

    /**
     * @notice Get the address of the current guard.
     * @return guard The address of the current guard contract.
     */
    function getGuard() internal view returns (address guard) {
        bytes32 slot = GUARD_STORAGE_SLOT;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            guard := sload(slot)
        }
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
        // solhint-disable-next-line no-inline-assembly
        assembly {
            size := extcodesize(account)
        }

        // If the code size is greater than 0, it is a contract; otherwise, it is an EOA.
        return size > 0;
    }
}
