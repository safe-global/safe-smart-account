// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;
import {BaseTransactionGuard, ITransactionGuard} from "./../../base/GuardManager.sol";
import {BaseModuleGuard, IModuleGuard} from "./../../base/ModuleManager.sol";
import {IERC165} from "./../../interfaces/IERC165.sol";

/**
 * @title BaseGuard - Inherits BaseTransactionGuard and BaseModuleGuard.
 */
abstract contract BaseGuard is BaseTransactionGuard, BaseModuleGuard {
    /**
     * @inheritdoc IERC165
     */
    function supportsInterface(bytes4 interfaceId) external view virtual override(BaseTransactionGuard, BaseModuleGuard) returns (bool) {
        return
            interfaceId == type(ITransactionGuard).interfaceId || // 0xe6d7a83a
            interfaceId == type(IModuleGuard).interfaceId || // 0x58401ed8
            interfaceId == type(IERC165).interfaceId; // 0x01ffc9a7
    }
}
