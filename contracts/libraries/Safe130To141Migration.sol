// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import {SafeStorage} from "../libraries/SafeStorage.sol";

interface ISafe {
    function setFallbackHandler(address handler) external;
}

/**
 * @title Migration Contract for Safe Upgrade
 * @notice This contract facilitates the migration of a Safe contract from version 1.3.0 to 1.4.1.
 *         The older versions should use built-in upgrade methods.
 */
contract Safe130To141Migration is SafeStorage {
    // Address of this contract
    address public immutable MIGRATION_SINGLETON;

    // Address of Safe contract version 1.4.1 Singleton
    address public constant SAFE_141_SINGLETON = address(0x41675C099F32341bf84BFc5382aF534df5C7461a);

    // Address of Safe contract version 1.4.1 Singleton (L2)
    address public constant SAFE_141_SINGLETON_L2 = address(0x29fcB43b46531BcA003ddC8FCB67FFE91900C762);

    // Address of Safe contract version 1.4.1 Compatibility Fallback Handler
    address public constant SAFE_141_FALLBACK_HANDLER = address(0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99);

    /**
     * @notice Constructor
     * @dev Initializes the migrationSingleton with the contract's own address.
     */
    constructor() {
        MIGRATION_SINGLETON = address(this);

        require(isContract(SAFE_141_SINGLETON), "Safe 1.4.1 Singleton is not deployed");
        require(isContract(SAFE_141_SINGLETON_L2), "Safe 1.4.1 Singleton (L2) is not deployed");
        require(isContract(SAFE_141_FALLBACK_HANDLER), "Safe 1.4.1 Fallback Handler is not deployed");
    }

    /**
     * @notice Event indicating a change of master copy address.
     * @param singleton New master copy address
     */
    event ChangedMasterCopy(address singleton);

    /**
     * @notice Migrate to Safe 1.4.1 Singleton (L1) at `SAFE_141_SINGLETON`
     * @dev This function should only be called via a delegatecall to perform the upgrade.
     */
    function migrate() public {
        require(address(this) != MIGRATION_SINGLETON, "Migration should only be called via delegatecall");

        singleton = SAFE_141_SINGLETON;

        emit ChangedMasterCopy(singleton);
    }

    /** @notice Migrate to Safe 1.4.1 Singleton (L1) at `SAFE_141_SINGLETON` and sets the fallback handler to `SAFE_141_FALLBACK_HANDLER`
     * @dev This function should only be called via a delegatecall to perform the upgrade.
     */
    function migrateWithFallbackHandler() public {
        migrate();

        ISafe(address(this)).setFallbackHandler(SAFE_141_FALLBACK_HANDLER);
    }

    /**
     * @notice Migrate to Safe 1.4.1 Singleton (L2) at `SAFE_141_SINGLETON_L2`
     * @dev This function should only be called via a delegatecall to perform the upgrade.
     */
    function migrateL2() public {
        require(address(this) != MIGRATION_SINGLETON, "Migration should only be called via delegatecall");

        singleton = SAFE_141_SINGLETON_L2;

        emit ChangedMasterCopy(singleton);
    }

    /** @notice Migrate to Safe 1.4.1 Singleton (L2) at `SAFE_141_SINGLETON_L2` and sets the fallback handler to `SAFE_141_FALLBACK_HANDLER`
     * @dev This function should only be called via a delegatecall to perform the upgrade.
     */
    function migrateL2WithFallbackHandler() public {
        migrateL2();

        ISafe(address(this)).setFallbackHandler(SAFE_141_FALLBACK_HANDLER);
    }

    function isContract(address account) internal view returns (bool) {
        uint256 size;
        assembly {
            size := extcodesize(account)
        }
        return size > 0;
    }
}
