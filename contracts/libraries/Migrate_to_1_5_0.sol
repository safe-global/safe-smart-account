// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import "../libraries/SafeStorage.sol";
import "../base/GuardManager.sol";

/**
 * @title Migration Contract for Safe Upgrade
 * @notice This contract facilitates the migration of a Safe contract from version 1.3.0/1.4.1 to 1.5.0.
 */
contract Safe150Migration is SafeStorage {
    // Address of this contract
    address public immutable migrationSingleton;

    // Address of Safe contract version 1.5.0 Singleton
    address public constant safe150Singleton = address(0x41675C099F32341bf84BFc5382aF534df5C7461a);

    // Address of Safe contract version 1.5.0 Singleton (L2)
    address public constant safe150SingletonL2 = address(0x29fcB43b46531BcA003ddC8FCB67FFE91900C762);

    // keccak256("guard_manager.guard.address")
    bytes32 internal constant GUARD_STORAGE_SLOT = 0x4a204f620c8c5ccdca3fd54d003badd85ba500436a431f0cbda4f558c93c34c8;

    /**
     * @notice Constructor
     * @dev Initializes the migrationSingleton with the contract's own address.
     */
    constructor() {
        migrationSingleton = address(this);
    }

    /**
     * @notice Event indicating a change of master copy address.
     * @param singleton New master copy address
     */
    event ChangedMasterCopy(address singleton);

    function checkGuard() private view {
        address guard = getGuard();

        if (guard != address(0)) {
            require(Guard(guard).supportsInterface(type(Guard).interfaceId), "GS300");
        }
    }

    /**
     * @notice Migrate to Safe 1.5.0 Singleton (L1) at `safe150Singleton`
     * @dev This function should only be called via a delegatecall to perform the upgrade.
     */
    function migrate() public {
        require(address(this) != migrationSingleton, "Migration should only be called via delegatecall");

        checkGuard();

        singleton = safe150Singleton;
        emit ChangedMasterCopy(singleton);
    }

    /**
     * @notice Migrate to Safe 1.5.0 Singleton (L2) at `safe150SingletonL2`
     * @dev This function should only be called via a delegatecall to perform the upgrade.
     */
    function migrateL2() public {
        require(address(this) != migrationSingleton, "Migration should only be called via delegatecall");

        checkGuard();

        singleton = safe150SingletonL2;
        emit ChangedMasterCopy(singleton);
    }

    /**
     * @dev Safe's Internal method to retrieve the current guard
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
}
