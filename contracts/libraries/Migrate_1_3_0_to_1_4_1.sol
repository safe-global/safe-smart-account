// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import "../libraries/SafeStorage.sol";

/**
 * @title Migration Contract for Safe Upgrade
 * @notice This contract facilitates the migration of a Safe contract from version 1.3.0 to 1.4.1.
 */
contract Safe130To141Migration is SafeStorage {
    // Address of this contract
    address public immutable migrationSingleton;

    // Address of Safe contract version 1.4.1 Singleton
    address public constant safe141Singleton = address(0x41675C099F32341bf84BFc5382aF534df5C7461a);

    // Address of Safe contract version 1.4.1 Singleton (L2)
    address public constant safe141SingletonL2 = address(0x29fcB43b46531BcA003ddC8FCB67FFE91900C762);

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

    /**
     * @notice Migrate to Safe 1.4.1 Singleton (L1) at `safe141Singleton`
     * @dev This function should only be called via a delegatecall to perform the upgrade.
     */
    function migrate() public {
        require(address(this) != migrationSingleton, "Migration should only be called via delegatecall");

        singleton = safe141Singleton;
        emit ChangedMasterCopy(singleton);
    }

    /**
     * @notice Migrate to Safe 1.4.1 Singleton (L2) at `safe141SingletonL2`
     * @dev This function should only be called via a delegatecall to perform the upgrade.
     */
    function migrateL2() public {
        require(address(this) != migrationSingleton, "Migration should only be called via delegatecall");

        singleton = safe141SingletonL2;
        emit ChangedMasterCopy(singleton);
    }
}
