// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import {Enum} from "../../libraries/Enum.sol";
import {BaseGuard, Guard} from "../../base/GuardManager.sol";
import {BaseModuleGuard, IModuleGuard} from "../../base/ModuleManager.sol";
import {IERC165} from "../../interfaces/IERC165.sol";

/**
 * @title DelegateCallTransactionGuard - Limits delegate calls to a specific target.
 * @author Richard Meissner - @rmeissner
 */
contract DelegateCallTransactionGuard is BaseGuard, BaseModuleGuard {
    address public immutable ALLOWED_TARGET;

    constructor(address target) {
        ALLOWED_TARGET = target;
    }

    // solhint-disable-next-line payable-fallback
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
        // solhint-disable-next-line no-unused-vars
        address payable,
        bytes memory,
        address
    ) external view override {
        require(operation != Enum.Operation.DelegateCall || to == ALLOWED_TARGET, "This call is restricted");
    }

    function checkAfterExecution(bytes32, bool) external view override(Guard, IModuleGuard) {}

    /**
     * @notice Called by the Safe contract before a transaction is executed via a module.
     * @param to Destination address of Safe transaction.
     * @param value Ether value of Safe transaction.
     * @param data Data payload of Safe transaction.
     * @param operation Operation type of Safe transaction.
     * @param module Module executing the transaction.
     */
    function checkTransaction(
        address to,
        uint256 value,
        bytes memory data,
        Enum.Operation operation,
        address module
    ) external view override returns (bytes32 moduleTxHash) {
        require(operation != Enum.Operation.DelegateCall || to == ALLOWED_TARGET, "This call is restricted");
        moduleTxHash = keccak256(abi.encodePacked(to, value, data, operation, module));
    }

    function supportsInterface(bytes4 interfaceId) external view virtual override(BaseGuard, BaseModuleGuard) returns (bool) {
        return
            interfaceId == type(Guard).interfaceId || // 0xe6d7a83a
            interfaceId == type(IModuleGuard).interfaceId || // 0xd7e8e3a4
            interfaceId == type(IERC165).interfaceId; // 0x01ffc9a7
    }
}
