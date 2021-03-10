// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;
import "../common/SelfAuthorized.sol";

/// @title Migration - migrates a Safe contract from 1.3.0 to 1.2.0
/// @author Richard Meissner - <richard@gnosis.io>
contract Migration is SelfAuthorized {
    bytes32 private constant DOMAIN_SEPARATOR_TYPEHASH = 0x035aff83d86937d35b32e04f0ddc6ff469290eef2f1b692d8a815c89404d4749;

    address public immutable safe120Singleton;
    constructor(address targetSingleton) {
        require(targetSingleton != address(0), "Invalid singleton address provided");
        safe120Singleton = targetSingleton;
    }

    event ChangedMasterCopy(address singleton);

    // Here to have the same storage layout as the Safe
    address private singleton;
    // Some unused slots to have the correct layout
    bytes32 private _slot1;
    bytes32 private _slot2;
    bytes32 private _slot3;
    bytes32 private _slot4;
    bytes32 private _slot5;
    // For the migration we need to set the old domain seperator in storage
    bytes32 private domainSeparator;

    /// @dev Allows to migrate the contract. This can only be done via a Safe transaction.
    function migrate()
        public
        authorized
    {
        // Master copy address cannot be null.
        singleton = safe120Singleton;
        domainSeparator = keccak256(abi.encode(DOMAIN_SEPARATOR_TYPEHASH, this));
        emit ChangedMasterCopy(singleton);
    }
}