// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;
import {IERC165} from "../../interfaces/IERC165.sol";
import {BaseTransactionGuard, Guard} from "../../base/GuardManager.sol";
import {BaseModuleGuard, IModuleGuard} from "../../base/ModuleManager.sol";

/**
 * @title BaseGuard - Inherits BaseTransactionGuard and BaseModuleGuard.
 */
abstract contract BaseGuard is BaseTransactionGuard, BaseModuleGuard {
    /**
     * @notice Checks if the contract supports an interface.
     * @param interfaceId The interface identifier.
     * @return True if the interfaceId matches the interfaceId of Guard/IModuleGuard/IERC165, false otherwise.
     */
    function supportsInterface(bytes4 interfaceId) external view virtual override(BaseTransactionGuard, BaseModuleGuard) returns (bool) {
        return
            interfaceId == type(Guard).interfaceId || // 0xe6d7a83a
            interfaceId == type(IModuleGuard).interfaceId || // 0xe1ab3a1a
            interfaceId == type(IERC165).interfaceId; // 0x01ffc9a7
    }

    /**
     * @notice Called by the Safe contract after a transaction is executed.
     *         This function definition is required here to avoid compilation errors as both Guard and IModuleGuard have identical function declaration.
     */
    function checkAfterExecution(bytes32, bool) external virtual override(Guard, IModuleGuard) {}
}
