// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

/// @title StorageSlots
/// @notice Library for managing specific storage slots used by Safe contracts
/// @dev Each constant is the keccak256 hash of a specific string key to avoid slot collisions
library StorageSlots {
    /// @dev keccak256("fallback_manager.handler.address") slot for the fallback handler address
    bytes32 internal constant FALLBACK_HANDLER_STORAGE_SLOT = 0x6c9a6c4a39284e37ed1cf53d337577d14212a4870fb976a4366c693b939918d5;

    /// @dev keccak256("guard_manager.guard.address") slot for the guard contract address
    bytes32 internal constant GUARD_STORAGE_SLOT = 0x4a204f620c8c5ccdca3fd54d003badd85ba500436a431f0cbda4f558c93c34c8;

    /// @dev keccak256("module_manager.module_guard.address") slot for the module guard contract address
    bytes32 internal constant MODULE_GUARD_STORAGE_SLOT = 0xb104e0b93118902c651344349b610029d694cfdec91c589c91ebafbcd0289947;
}
