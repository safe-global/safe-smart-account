// SPDX-License-Identifier: LGPL-3.0-only
/* solhint-disable one-contract-per-file */
pragma solidity >=0.7.0 <0.9.0;

import {SafeStorage} from "../libraries/SafeStorage.sol";

interface ISafe {
    function setFallbackHandler(address handler) external;
}

/**
 * @title Migration Contract for Safe Upgrade
 * @notice This contract facilitates the migration of a Safe contract from version 1.3.0 to 1.4.1.
 *         The older versions should use built-in upgrade methods.
 * @dev IMPORTANT: The migration will only work with proxies that store the implementation address in the storage slot 0.
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
        // The `migrate` function will take care of the delegatecall check
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
        // The `migrateL2` function will take care of the delegatecall check
        migrateL2();

        ISafe(address(this)).setFallbackHandler(SAFE_141_FALLBACK_HANDLER);
    }

    /**
     * @notice Checks whether an Ethereum address corresponds to a contract or an externally owned account (EOA).
     *
     * @param account The Ethereum address to be checked.
     *
     * @return A boolean value indicating whether the address is associated with a contract (true) or an EOA (false).
     *
     * @dev This function relies on the `extcodesize` assembly opcode to determine whether an address is a contract.
     * It may return incorrect results in some edge cases:
     *
     * - During the contract deployment process, including the constructor, this function may incorrectly identify the
     *   contract's own address as an EOA, as the code is not yet deployed.
     *
     * - If a contract performs a self-destruct operation (using `selfdestruct`) after deployment, this function may
     *   incorrectly identify the address as an EOA once the contract is destroyed, as its code will be removed.
     *
     * - When interacting with external contracts that use delegatecall or other mechanisms to execute code from
     *   different contracts, this function may not accurately distinguish between a contract and an EOA, as it only
     *   checks the code size at the specified address.
     *
     * - Contracts that are created using the CREATE2 opcode may not be accurately identified as contracts by this
     *   function, especially if the code is not deployed until after the creation.
     *
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
