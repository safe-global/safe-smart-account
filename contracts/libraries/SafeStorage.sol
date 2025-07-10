// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

/**
 * @title Safe Storage
 * @notice Storage layout of the Safe smart account contracts to be used in libraries.
 * @dev Should be always the first base contract of a library that is used with a Safe.
 * @author Richard Meissner - @rmeissner
 */
abstract contract SafeStorage {
    /**
     * @dev See <../common/Singleton.sol>.
     */
    address internal singleton;

    /**
     * @dev See <../common/ModuleManager.sol>.
     */
    mapping(address => address) internal modules;

    /**
     * @dev See <../common/OwnerManager.sol>.
     */
    mapping(address => address) internal owners;

    /**
     * @dev See <../common/OwnerManager.sol>.
     */
    uint256 internal ownerCount;

    /**
     * @dev See <../common/OwnerManager.sol>.
     */
    uint256 internal threshold;

    /**
     * @dev See <../Safe.sol>.
     */
    uint256 internal nonce;

    /**
     * @dev See <../Safe.sol>.
     */
    bytes32 internal _deprecatedDomainSeparator;

    /**
     * @dev See <../Safe.sol>.
     */
    mapping(bytes32 => uint256) internal signedMessages;

    /**
     * @dev See <../Safe.sol>.
     */
    mapping(address => mapping(bytes32 => uint256)) internal approvedHashes;
}

/**
 * @dev The storage slot used for storing the currently configured fallback handler address.
 *      Precomputed value of: `keccak256("fallback_manager.handler.address")`.
 */
bytes32 constant FALLBACK_HANDLER_STORAGE_SLOT = 0x6c9a6c4a39284e37ed1cf53d337577d14212a4870fb976a4366c693b939918d5;

/**
 * @dev The storage slot used for storing the currently configured transaction guard.
 *      Precomputed value of: `keccak256("guard_manager.guard.address")`.
 */
bytes32 constant GUARD_STORAGE_SLOT = 0x4a204f620c8c5ccdca3fd54d003badd85ba500436a431f0cbda4f558c93c34c8;

/**
 * @dev The storage slot used for storing the currently configured module guard.
 *      Precomputed value of: `keccak256("module_manager.module_guard.address")`.
 */
bytes32 constant MODULE_GUARD_STORAGE_SLOT = 0xb104e0b93118902c651344349b610029d694cfdec91c589c91ebafbcd0289947;
