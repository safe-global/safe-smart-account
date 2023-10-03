// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import {Enum} from "../../common/Enum.sol";
import {BaseGuard} from "../../base/GuardManager.sol";
import {OwnerManager} from "../../base/OwnerManager.sol";
import {ModuleManager} from "../../base/ModuleManager.sol";
import {Safe} from "../../Safe.sol";
import {StorageAccessible} from "../../common/StorageAccessible.sol";

/// @title AdminGuard
/// @author 👦🏻👦🏻.eth
/// @dev This guard contract limits delegate calls to two immutable targets
/// and uses hook mechanisms to prevent Modules from altering sensitive state variables

contract AdminGuard is BaseGuard {
    address public constant ALLOWED_MULTICALL3 = 0xcA11bde05977b3631167028862bE2a173976CA11;

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
    ) external pure override {
        require(operation != Enum.Operation.DelegateCall || to == ALLOWED_MULTICALL3, "RESTRICTED");
    }

    function checkAfterExecution(bytes32 stateHash, bool) external view override {
        require(stateHash == _hashSafeSensitiveState(), "STATE_VIOLATION");
    }

    /**
     * @notice Called by the Safe contract before a transaction is executed via a module.
     * @param to Destination address of Safe transaction.
     * @param '' Ether value of Safe transaction.
     * @param '' Data payload of Safe transaction.
     * @param operation Operation type of Safe transaction.
     * @param '' Module executing the transaction.
     */
    function checkModuleTransaction(address to, uint256, bytes memory, Enum.Operation operation, address)
        external
        view
        override
        returns (bytes32 stateHash)
    {
        require(operation != Enum.Operation.DelegateCall || to == ALLOWED_MULTICALL3, "RESTRICTED");

        stateHash = _hashSafeSensitiveState();
    }

    function _hashSafeSensitiveState() internal view returns (bytes32) {
        // get sensitive state which should not be mutated by modules using public functions wherever possible and `getStorageAt()` when not
        address singleton = address(uint160(uint256(bytes32(StorageAccessible(msg.sender).getStorageAt(0, 1)))));

        bytes32 fallbackHandlerSlot = keccak256("fallback_manager.handler.address");
        address fallbackHandler = address(
            uint160(uint256(bytes32(StorageAccessible(msg.sender).getStorageAt(uint256(fallbackHandlerSlot), 1))))
        );

        bytes32 guardStorageSlot = keccak256("guard_manager.guard.address");
        address guard =
            address(uint160(uint256(bytes32(StorageAccessible(msg.sender).getStorageAt(uint256(guardStorageSlot), 1)))));

        (address[] memory modules,) = ModuleManager(msg.sender).getModulesPaginated(address(0x1), 32);

        address[] memory owners = OwnerManager(msg.sender).getOwners();
        uint256 ownerCountSlot = 4;
        uint256 ownerCount = uint256(bytes32(StorageAccessible(msg.sender).getStorageAt(ownerCountSlot, 1)));

        uint256 threshold = OwnerManager(msg.sender).getThreshold();
        uint256 nonce = Safe(payable(msg.sender)).nonce();

        return keccak256(
            abi.encodePacked(singleton, fallbackHandler, guard, modules, owners, ownerCount, threshold, nonce)
        );
    }
}
