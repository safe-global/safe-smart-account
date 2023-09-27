// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import {Enum} from "../../common/Enum.sol";
import {BaseGuard} from "../../base/GuardManager.sol";
import {OwnerManager} from "../../base/OwnerManager.sol";
import {Safe} from "../../Safe.sol";
import {StorageAccessible} from "../../common/StorageAccessible.sol";

/// @title AdminGuard 
/// @author 👦🏻👦🏻.eth
/// @dev This guard contract limits delegate calls to two immutable targets 
/// and uses hook mechanisms to prevent Modules from altering sensitive state variables 

contract AdminGuard is BaseGuard {
    address public constant ALLOWED_MULTICALL3 = 0xcA11bde05977b3631167028862bE2a173976CA11;
    address public constant moduleA = 0x7ff6363cd3A4E7f9ece98d78Dd3c862bacE2163d; //sym
    address public constant moduleB = 0xFFFFfFfFA2eC6F66a22017a0Deb0191e5F8cBc35; //rob

    fallback() external {
        // We don't revert on fallback to avoid issues in case of a Safe upgrade
        // E.g. The expected check method might change and then the Safe would be locked.
    }

    /**
     * @notice Called by the Safe contract before a transaction is executed.
     * @dev  Reverts if the transaction is a delegate call to contract other than the allowed one.
     * @param to Destination address of Safe transaction.
     * @param operation Operation type of Safe transaction.
     */
    function checkTransaction(
        address to,
        uint256,
        bytes memory,
        Enum.Operation operation,
        uint256,
        uint256,
        uint256,
        address,
        address payable,
        bytes memory,
        address
    ) external view override {
        require(
            operation != Enum.Operation.DelegateCall 
            || to == ALLOWED_MULTICALL_NONCE 
            || to == ALLOWED_MULTICALL_ARACHNID,
            "RESTRICTED"
        );
    }

    function checkAfterExecution(bytes32 stateHash, bool) external view override {
        require(stateHash == _hashSafeSensitiveState(), "STATE_VIOLATION");
    }

    /**
     * @notice Called by the Safe contract before a transaction is executed via a module.
     * @param to Destination address of Safe transaction.
     * @param value Ether value of Safe transaction.
     * @param data Data payload of Safe transaction.
     * @param operation Operation type of Safe transaction.
     * @param module Module executing the transaction.
     */
    function checkModuleTransaction(
        address to,
        uint256 value,
        bytes memory data,
        Enum.Operation operation,
        address module
    ) external view override returns (bytes32 stateHash) {
        require(
            operation != Enum.Operation.DelegateCall 
            || to == ALLOWED_MULTICALL_NONCE
            || to == ALLOWED_MULTICALL_ARACHNID,
            "RESTRICTED"
        );

        stateHash = _hashSafeSensitiveState();
    }

    function _hashSafeSensitiveState() internal view returns (bytes32) {
        address singleton = address(uint160(uint256(bytes32(StorageAccessible(msg.sender).getStorageAt(0, 1)))));
        bytes32 fallbackHandlerSlot = keccak256("fallback_manager.handler.address");
        address fallbackHandler = address(uint160(uint256(bytes32(StorageAccessible(msg.sender).getStorageAt(uint256(fallbackHandlerSlot), 1)))));
        address guard = address(this);
        bytes32 moduleSlotA = keccak256(abi.encodePacked(bytes32(uint256(uint160(moduleA))), 1));
        bytes32 moduleSlotB = keccak256(abi.encodePacked(bytes32(uint256(uint160(moduleB))), 1));
        address moduleValueA = address(uint160(uint256(bytes32(StorageAccessible(msg.sender).getStorageAt(moduleSlotA, 1)))));
        address moduleValueB = address(uint160(uint256(bytes32(StorageAccessible(msg.sender).getStorageAt(moduleSlotB, 1)))));
        address[] memory owners = OwnerManager(msg.sender).getOwners();
        uint256 ownerCount = owners.length;
        uint256 threshold = OwnerManager(msg.sender).getThreshold();
        uint256 nonce = Safe(msg.sender).nonce();

        return keccak256(abi.encodePacked(singleton, fallbackHandler, guard, moduleValueA, moduleValueB, owners, threshold, nonce));
    }
}
