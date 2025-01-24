// SPDX-License-Identifier: LGPL-3.0-only
/* solhint-disable one-contract-per-file */
pragma solidity >=0.7.0 <0.9.0;
import {SelfAuthorized} from "./../common/SelfAuthorized.sol";
import {IERC165} from "./../interfaces/IERC165.sol";
import {IModuleManager} from "./../interfaces/IModuleManager.sol";
import {Enum} from "./../libraries/Enum.sol";
import {Executor} from "./Executor.sol";

/**
 * @title IModuleGuard Interface
 */
interface IModuleGuard is IERC165 {
    /**
     * @notice Checks the module transaction details.
     * @dev The function needs to implement module transaction validation logic.
     * @param to The address to which the transaction is intended.
     * @param value The value of the transaction in Wei.
     * @param data The transaction data.
     * @param operation The type of operation of the module transaction.
     * @param module The module involved in the transaction.
     * @return moduleTxHash The hash of the module transaction.
     */
    function checkModuleTransaction(
        address to,
        uint256 value,
        bytes memory data,
        Enum.Operation operation,
        address module
    ) external returns (bytes32 moduleTxHash);

    /**
     * @notice Checks after execution of module transaction.
     * @dev The function needs to implement a check after the execution of the module transaction.
     * @param txHash The hash of the module transaction.
     * @param success The status of the module transaction execution.
     */
    function checkAfterModuleExecution(bytes32 txHash, bool success) external;
}

abstract contract BaseModuleGuard is IModuleGuard {
    function supportsInterface(bytes4 interfaceId) external view virtual override returns (bool) {
        return
            interfaceId == type(IModuleGuard).interfaceId || // 0x58401ed8
            interfaceId == type(IERC165).interfaceId; // 0x01ffc9a7
    }
}

/**
 * @title Module Manager - A contract managing Safe modules
 * @notice Modules are extensions with unlimited access to a Safe that can be added to a Safe by its owners.
           ⚠️ WARNING: Modules are a security risk since they can execute arbitrary transactions, 
           so only trusted and audited modules should be added to a Safe. A malicious module can
           completely takeover a Safe.
 * @author Stefan George - @Georgi87
 * @author Richard Meissner - @rmeissner
 */
abstract contract ModuleManager is SelfAuthorized, Executor, IModuleManager {
    // SENTINEL_MODULES is used to traverse `modules`, so that:
    //      1. `modules[SENTINEL_MODULES]` contains the first module
    //      2. `modules[last_module]` points back to SENTINEL_MODULES
    address internal constant SENTINEL_MODULES = address(0x1);

    // keccak256("module_manager.module_guard.address")
    bytes32 internal constant MODULE_GUARD_STORAGE_SLOT = 0xb104e0b93118902c651344349b610029d694cfdec91c589c91ebafbcd0289947;

    mapping(address => address) internal modules;

    /**
     * @notice Setup function sets the initial storage of the contract.
     *         Optionally executes a delegate call to another contract to setup the modules.
     * @param to Optional destination address of the call to execute.
     * @param data Optional data of call to execute.
     */
    function setupModules(address to, bytes memory data) internal {
        if (modules[SENTINEL_MODULES] != address(0)) revertWithError("GS100");
        modules[SENTINEL_MODULES] = SENTINEL_MODULES;
        if (to != address(0)) {
            if (!isContract(to)) revertWithError("GS002");
            // Setup has to complete successfully or the transaction fails.
            if (!execute(to, 0, data, Enum.Operation.DelegateCall, type(uint256).max)) revertWithError("GS000");
        }
    }

    /**
     * @notice Runs pre-execution checks for module transactions if a guard is enabled.
     * @param to Target address of module transaction.
     * @param value Ether value of module transaction.
     * @param data Data payload of module transaction.
     * @param operation Operation type of module transaction.
     * @return guard Guard to be used for checking.
     * @return guardHash Hash returned from the guard tx check.
     */
    function preModuleExecution(
        address to,
        uint256 value,
        bytes memory data,
        Enum.Operation operation
    ) internal returns (address guard, bytes32 guardHash) {
        onBeforeExecTransactionFromModule(to, value, data, operation);
        guard = getModuleGuard();

        // Only whitelisted modules are allowed.
        require(msg.sender != SENTINEL_MODULES && modules[msg.sender] != address(0), "GS104");

        if (guard != address(0)) {
            guardHash = IModuleGuard(guard).checkModuleTransaction(to, value, data, operation, msg.sender);
        }
    }

    /**
     * @notice Runs post-execution checks for module transactions if a guard is enabled.
     * @param guardHash Hash returned from the guard during pre execution check.
     * @param success Boolean flag indicating if the call succeeded.
     * @param guard Guard to be used for checking.
     * @dev Emits event based on module transaction success.
     */
    function postModuleExecution(address guard, bytes32 guardHash, bool success) internal {
        if (guard != address(0)) {
            IModuleGuard(guard).checkAfterModuleExecution(guardHash, success);
        }
        if (success) emit ExecutionFromModuleSuccess(msg.sender);
        else emit ExecutionFromModuleFailure(msg.sender);
    }

    /**
     * @inheritdoc IModuleManager
     */
    function enableModule(address module) public override authorized {
        // Module address cannot be null or sentinel.
        if (module == address(0) || module == SENTINEL_MODULES) revertWithError("GS101");
        // Module cannot be added twice.
        if (modules[module] != address(0)) revertWithError("GS102");
        modules[module] = modules[SENTINEL_MODULES];
        modules[SENTINEL_MODULES] = module;
        emit EnabledModule(module);
    }

    /**
     * @inheritdoc IModuleManager
     */
    function disableModule(address prevModule, address module) public override authorized {
        // Validate module address and check that it corresponds to module index.
        if (module == address(0) || module == SENTINEL_MODULES) revertWithError("GS101");
        if (modules[prevModule] != module) revertWithError("GS103");
        modules[prevModule] = modules[module];
        modules[module] = address(0);
        emit DisabledModule(module);
    }

    /**
     * @inheritdoc IModuleManager
     */
    function execTransactionFromModule(
        address to,
        uint256 value,
        bytes memory data,
        Enum.Operation operation
    ) external override returns (bool success) {
        (address guard, bytes32 guardHash) = preModuleExecution(to, value, data, operation);
        success = execute(to, value, data, operation, type(uint256).max);
        postModuleExecution(guard, guardHash, success);
    }

    /**
     * @inheritdoc IModuleManager
     */
    function execTransactionFromModuleReturnData(
        address to,
        uint256 value,
        bytes memory data,
        Enum.Operation operation
    ) external override returns (bool success, bytes memory returnData) {
        (address guard, bytes32 guardHash) = preModuleExecution(to, value, data, operation);
        success = execute(to, value, data, operation, type(uint256).max);
        /* solhint-disable no-inline-assembly */
        /// @solidity memory-safe-assembly
        assembly {
            // Load free memory location
            returnData := mload(0x40)
            // We allocate memory for the return data by setting the free memory location to
            // current free memory location + data size + 32 bytes for data size value
            mstore(0x40, add(returnData, add(returndatasize(), 0x20)))
            // Store the size
            mstore(returnData, returndatasize())
            // Store the data
            returndatacopy(add(returnData, 0x20), 0, returndatasize())
        }
        /* solhint-enable no-inline-assembly */
        postModuleExecution(guard, guardHash, success);
    }

    /**
     * @inheritdoc IModuleManager
     */
    function isModuleEnabled(address module) public view override returns (bool) {
        return SENTINEL_MODULES != module && modules[module] != address(0);
    }

    /**
     * @inheritdoc IModuleManager
     */
    function getModulesPaginated(address start, uint256 pageSize) external view override returns (address[] memory array, address next) {
        if (start != SENTINEL_MODULES && !isModuleEnabled(start)) revertWithError("GS105");
        if (pageSize == 0) revertWithError("GS106");
        // Init array with max page size
        array = new address[](pageSize);

        // Populate return array
        uint256 moduleCount = 0;
        next = modules[start];
        while (next != address(0) && next != SENTINEL_MODULES && moduleCount < pageSize) {
            array[moduleCount] = next;
            next = modules[next];
            ++moduleCount;
        }

        /**
          Because of the argument validation, we can assume that the loop will always iterate over the valid module list values
          and the `next` variable will either be an enabled module or a sentinel address (signalling the end). 
          
          If we haven't reached the end inside the loop, we need to set the next pointer to the last element of the modules array
          because the `next` variable (which is a module by itself) acting as a pointer to the start of the next page is neither 
          included to the current page, nor will it be included in the next one if you pass it as a start.
        */
        if (next != SENTINEL_MODULES) {
            next = array[moduleCount - 1];
        }
        // Set the correct size of the returned array
        /* solhint-disable no-inline-assembly */
        /// @solidity memory-safe-assembly
        assembly {
            mstore(array, moduleCount)
        }
        /* solhint-enable no-inline-assembly */
    }

    /**
     * @notice Returns true if `account` is a contract.
     * @dev This function will return false if invoked during the constructor of a contract,
     *      as the code is not created until after the constructor finishes.
     * @param account The address being queried
     */
    function isContract(address account) internal view returns (bool) {
        uint256 size;
        /* solhint-disable no-inline-assembly */
        /// @solidity memory-safe-assembly
        assembly {
            size := extcodesize(account)
        }
        /* solhint-enable no-inline-assembly */
        return size > 0;
    }

    /**
     * @inheritdoc IModuleManager
     */
    function setModuleGuard(address moduleGuard) external override authorized {
        if (moduleGuard != address(0) && !IModuleGuard(moduleGuard).supportsInterface(type(IModuleGuard).interfaceId))
            revertWithError("GS301");

        bytes32 slot = MODULE_GUARD_STORAGE_SLOT;
        /* solhint-disable no-inline-assembly */
        /// @solidity memory-safe-assembly
        assembly {
            sstore(slot, moduleGuard)
        }
        /* solhint-enable no-inline-assembly */
        emit ChangedModuleGuard(moduleGuard);
    }

    /**
     * @dev Internal method to retrieve the current module guard
     * @return moduleGuard The address of the guard
     */
    function getModuleGuard() internal view returns (address moduleGuard) {
        bytes32 slot = MODULE_GUARD_STORAGE_SLOT;
        /* solhint-disable no-inline-assembly */
        /// @solidity memory-safe-assembly
        assembly {
            moduleGuard := sload(slot)
        }
        /* solhint-enable no-inline-assembly */
    }

    /**
     * @notice A hook that gets called before execution of {execTransactionFromModule*} methods.
     * @param to Destination address of module transaction.
     * @param value Ether value of module transaction.
     * @param data Data payload of module transaction.
     * @param operation Operation type of module transaction.
     */
    function onBeforeExecTransactionFromModule(address to, uint256 value, bytes memory data, Enum.Operation operation) internal virtual {}
}
