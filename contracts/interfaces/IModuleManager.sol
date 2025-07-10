// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;
import {Enum} from "../libraries/Enum.sol";

/**
 * @title Module Manager Interface
 * @notice Interface for managing Safe modules.
 * @dev Modules are extensions with unlimited access to a Safe that can be added to a Safe by its owners.
 *      ⚠️⚠️⚠️ WARNING: Modules are a security risk since they can execute arbitrary transactions,
 *      so only trusted and audited modules should be added to a Safe. A malicious module can
 *      completely takeover a Safe. ⚠️⚠️⚠️
 * @author @safe-global/safe-protocol
 */
interface IModuleManager {
    /**
     * @notice A module was enabled.
     * @param module The address of the enabled module.
     */
    event EnabledModule(address indexed module);

    /**
     * @notice A module was disabled.
     * @param module The address of the disabled module.
     */
    event DisabledModule(address indexed module);

    /**
     * @notice A module transaction successfully executed.
     * @param module The address of the module that executed the transaction.
     */
    event ExecutionFromModuleSuccess(address indexed module);

    /**
     * @notice A module transaction reverted during executed.
     * @param module The address of the module that executed the transaction.
     */
    event ExecutionFromModuleFailure(address indexed module);

    /**
     * @notice The module transaction guard changed.
     * @param moduleGuard The address of the new module transaction guard.
     */
    event ChangedModuleGuard(address indexed moduleGuard);

    /**
     * @notice Enables the module `module` for the Safe.
     * @dev This can only be done via a Safe transaction.
     * @param module Module to be whitelisted.
     */
    function enableModule(address module) external;

    /**
     * @notice Disables the module `module` for the Safe.
     * @dev This can only be done via a Safe transaction.
     * @param prevModule Previous module in the modules linked list. If the module to be
     *        disabled is the first (or only) element of the list, `prevModule` MUST be
     *        set to the sentinel address `0x1` (referred to as `SENTINEL_MODULES` in the
     *        implementation).
     * @param module Module to be removed.
     */
    function disableModule(address prevModule, address module) external;

    /**
     * @notice Execute `operation` to `to` with native token `value`.
     * @param to Destination address of the module transaction.
     * @param value Native token value of the module transaction.
     * @param data Data payload of the module transaction.
     * @param operation Operation type of the module transaction: 0 for `CALL` and 1 for `DELEGATECALL`.
     * @return success Boolean flag indicating if the call succeeded.
     */
    function execTransactionFromModule(
        address to,
        uint256 value,
        bytes memory data,
        Enum.Operation operation
    ) external returns (bool success);

    /**
     * @notice Execute `operation` to `to` with native token `value` and return data.
     * @param to Destination address of the module transaction.
     * @param value Native token value of the module transaction.
     * @param data Data payload of the module transaction.
     * @param operation Operation type of the module transaction: 0 for `CALL` and 1 for `DELEGATECALL`.
     * @return success Boolean flag indicating if the call succeeded.
     * @return returnData Data returned by the call.
     */
    function execTransactionFromModuleReturnData(
        address to,
        uint256 value,
        bytes memory data,
        Enum.Operation operation
    ) external returns (bool success, bytes memory returnData);

    /**
     * @notice Returns whether or not a module is enabled.
     * @return True if the module is enabled, false otherwise.
     */
    function isModuleEnabled(address module) external view returns (bool);

    /**
     * @notice Returns an array of modules.
     * @dev If all entries fit into a single page, the next pointer will be `address(0x1)`.
     *      If another page is present, next will be the last element of the returned array.
     * @param start Start of the page. Has to be a module or start pointer (`address(0x1)`).
     * @param pageSize Maximum number of modules that should be returned. Must be greater than 0.
     * @return array Array of modules.
     * @return next Start of the next page.
     */
    function getModulesPaginated(address start, uint256 pageSize) external view returns (address[] memory array, address next);

    /**
     * @notice Set Module Guard `moduleGuard` for the Safe. Make sure you trust the module guard.
     * @dev Set a module guard that checks transactions initiated by the module before and after execution.
     *      This can only be done via a Safe transaction.
     *      ⚠️⚠️⚠️ IMPORTANT: Since a module guard has full power to block Safe transaction execution initiated via a
     *      module, a broken module guard can cause a denial of service for the Safe modules. Make sure to carefully
     *      audit the module guard code and design recovery mechanisms. ⚠️⚠️⚠️
     * @param moduleGuard The address of the module guard to be used or the zero address to disable the module guard.
     */
    function setModuleGuard(address moduleGuard) external;
}
