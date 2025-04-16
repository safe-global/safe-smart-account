// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

/**
 * @title Safe Storage
 * @notice Storage layout of the Safe smart account contracts to be used in libraries.
 * @dev Should be always the first base contract of a library that is used with a Safe.
 * @author Richard Meissner - @rmeissner
 */
contract SafeStorage {
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
