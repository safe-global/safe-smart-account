// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

/**
 * @title SafeStorage - Storage layout of the Safe Smart Account contracts to be used in libraries.
 * @dev Should be always the first base contract of a library that is used with a Safe.
 * @author Richard Meissner - @rmeissner
 */
abstract contract SafeStorage {
    // From /common/Singleton.sol
    address internal singleton;
    // From /common/ModuleManager.sol
    mapping(address => address) internal modules;
    // From /common/OwnerManager.sol
    mapping(address => address) internal owners;
    uint256 internal ownerCount;
    uint256 internal threshold;

    // From /Safe.sol
    uint256 internal nonce;
    bytes32 internal _deprecatedDomainSeparator;
    mapping(bytes32 => uint256) internal signedMessages;
    mapping(address => mapping(bytes32 => uint256)) internal approvedHashes;
}
