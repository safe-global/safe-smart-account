// SPDX-License-Identifier: LGPL-3.0-only
/* solhint-disable one-contract-per-file */
pragma solidity >=0.7.0 <0.9.0;

import {ISafe} from "./../interfaces/ISafe.sol";
import {Enum} from "./../libraries/Enum.sol";
import {SafeStorage} from "./../libraries/SafeStorage.sol";

/**
 * @title Safe to SafeL2 Migration
 * @notice Migration Contract for updating a Safe from 1.1.1/1.3.0/1.4.1 versions to its L2 version.
 * @dev Useful when replaying a Safe from a non L2 network in a L2 network.
 *      This contract only facilitates the migration of a Safe contract from version:
 *      - 1.1.1 to 1.3.0-L2 or 1.4.1-L2
 *      - 1.3.0 to 1.3.0-L2
 *      - 1.4.1 to 1.4.1-L2
 *      Other versions are not supported
 *      IMPORTANT: The migration will only work with proxies that store the implementation address in the storage slot 0.
 */
contract SafeToL2Migration is SafeStorage {
    /**
     * @dev The address of the {SafeToL2Migration} contract.
     */
    address public immutable MIGRATION_SINGLETON;

    /**
     * @notice Safe to SafeL2 migration constructor.
     * @dev Initializes the `MIGRATION_SINGLETON` with the contract's own address.
     */
    constructor() {
        MIGRATION_SINGLETON = address(this);
    }

    /**
     * @notice Event indicating a change of master copy address.
     * @param singleton New master copy address.
     */
    event ChangedMasterCopy(address singleton);

    /**
     * @dev See <../Safe.sol>.
     */
    event SafeSetup(address indexed initiator, address[] owners, uint256 threshold, address initializer, address fallbackHandler);

    /**
     * @dev See <../SafeL2.sol>.
     */
    event SafeMultiSigTransaction(
        address to,
        uint256 value,
        bytes data,
        Enum.Operation operation,
        uint256 safeTxGas,
        uint256 baseGas,
        uint256 gasPrice,
        address gasToken,
        address payable refundReceiver,
        bytes signatures,
        bytes additionalInfo
    );

    /**
     * @notice Modifier to make a function callable via `DELEGATECALL` only.
     * @dev If the function is called via a regular call, it will revert.
     */
    modifier onlyDelegateCall() {
        require(address(this) != MIGRATION_SINGLETON, "Migration should only be called via delegatecall");
        _;
    }

    /**
     * @notice Modifier to prevent using initialized Safes.
     * @dev If Safe has a nonce higher than 0, it will revert.
     */
    modifier onlyNonceZero() {
        // Nonce is increased before executing a tx, so first executed tx will have nonce=1
        require(nonce == 1, "Safe must have not executed any tx");
        _;
    }

    /**
     * @notice Perform a migration to the `l2Singleton` address.
     * @dev Internal function implementing common migration steps, changes the `singleton` and emits {SafeMultiSigTransaction} event.
     */
    function migrate(address l2Singleton, bytes memory functionData) private {
        singleton = l2Singleton;

        // Encode nonce, sender, threshold.
        bytes memory additionalInfo = abi.encode(0, msg.sender, threshold);

        // Simulate a L2 transaction so Safe Tx Service indexer picks up the Safe.
        emit SafeMultiSigTransaction(
            MIGRATION_SINGLETON,
            0,
            functionData,
            Enum.Operation.DelegateCall,
            0,
            0,
            0,
            address(0),
            payable(address(0)),
            "", // We cannot detect signatures.
            additionalInfo
        );
        emit ChangedMasterCopy(l2Singleton);
    }

    /**
     * @notice Migrate from Safe 1.3.0/1.4.1 Singleton (L1) to the same version provided L2 singleton.
     *         Safe is required to have nonce 0 so indexing is possible after the migration.
     * @dev This function should only be called via a `DELEGATECALL` to perform the upgrade.
     *      Singletons versions will be checked, so it implies that those contracts exist.
     */
    function migrateToL2(address l2Singleton) external onlyDelegateCall onlyNonceZero {
        address _singleton = singleton;
        require(_singleton != l2Singleton, "Safe is already using the singleton");
        bytes32 oldSingletonVersion = keccak256(abi.encodePacked(ISafe(_singleton).VERSION()));
        bytes32 newSingletonVersion = keccak256(abi.encodePacked(ISafe(l2Singleton).VERSION()));

        require(oldSingletonVersion == newSingletonVersion, "L2 singleton must match current version singleton");
        // There's no way to make sure if address is a valid singleton, unless we configure the contract for every chain.
        require(
            newSingletonVersion == keccak256(abi.encodePacked("1.3.0")) || newSingletonVersion == keccak256(abi.encodePacked("1.4.1")),
            "Provided singleton version is not supported"
        );

        // Selector `0xef2624ae` is the precomputed value of `bytes4(keccak256("migrateToL2(address)"))`.
        bytes memory functionData = abi.encodeWithSelector(0xef2624ae, l2Singleton);
        migrate(l2Singleton, functionData);
    }

    /**
     * @notice Migrate from Safe 1.1.1 Singleton to 1.3.0-L2 or 1.4.1-L2
     *         Safe must be at nonce 0 so indexing is possible after the migration.
     * @dev This function should only be called via a `DELEGATECALL` to perform the upgrade.
     *      Singletons versions will be checked, so it implies that those contracts exist.
     *      A valid and compatible `fallbackHandler` needs to be provided.
     */
    function migrateFromV111(address l2Singleton, address fallbackHandler) external onlyDelegateCall onlyNonceZero {
        require(isContract(fallbackHandler), "fallbackHandler is not a contract");

        bytes32 oldSingletonVersion = keccak256(abi.encodePacked(ISafe(singleton).VERSION()));
        require(oldSingletonVersion == keccak256(abi.encodePacked("1.1.1")), "Provided singleton version is not supported");

        bytes32 newSingletonVersion = keccak256(abi.encodePacked(ISafe(l2Singleton).VERSION()));
        require(
            newSingletonVersion == keccak256(abi.encodePacked("1.3.0")) || newSingletonVersion == keccak256(abi.encodePacked("1.4.1")),
            "Provided singleton version is not supported"
        );

        ISafe safe = ISafe(address(this));
        safe.setFallbackHandler(fallbackHandler);

        // Safes < 1.3.0 did not emit SafeSetup, so Safe Tx Service backend needs the event to index the Safe.
        emit SafeSetup(MIGRATION_SINGLETON, getOwners(), threshold, address(0), fallbackHandler);

        // Selector `0xd9a20812` is the precomputed value of `bytes4(keccak256("migrateFromV111(address,address)"))`.
        bytes memory functionData = abi.encodeWithSelector(0xd9a20812, l2Singleton, fallbackHandler);
        migrate(l2Singleton, functionData);
    }

    /**
     * @notice Best-effort check of whether an address corresponds to a contract or an externally owned account (EOA).
     * @dev This function relies on the `EXTCODESIZE` assembly opcode to determine whether an address is a contract.
     *      It may return incorrect results in some edge cases (for example, during contract creation).
     * @param account The address of the account to be checked.
     * @return A boolean value indicating whether the address has code (true) or not (false).
     */
    function isContract(address account) internal view returns (bool) {
        uint256 size;
        /* solhint-disable no-inline-assembly */
        /// @solidity memory-safe-assembly
        assembly {
            size := extcodesize(account)
        }
        /* solhint-enable no-inline-assembly */

        // If the code size is greater than 0, it appears to be a contract; otherwise, it appears to be an EOA.
        return size > 0;
    }

    /**
     * @notice Returns a list of Safe owners.
     * @dev This function is copied from {OwnerManager} and takes advantage of the fact that
     *      migration happens with a `DELEGATECALL` in the context of the migrating account, which allows
     *      us to read the owners directly from storage and avoid the additional overhead of a `CALL`
     *      into the account implementation. Note that we can rely on the memory layout of the {owners}.
     * @return Array of Safe owners.
     */
    function getOwners() internal view returns (address[] memory) {
        address[] memory array = new address[](ownerCount);
        address sentinelOwners = address(0x1);
        // populate return array
        uint256 index = 0;
        address currentOwner = owners[sentinelOwners];
        while (currentOwner != sentinelOwners) {
            array[index] = currentOwner;
            currentOwner = owners[currentOwner];
            ++index;
        }
        return array;
    }
}
