pragma solidity 0.4.24;
import "./Enum.sol";
import "./Executor.sol";
import "./Module.sol";
import "./SelfAuthorized.sol";


/// @title Module Manager - A contract that manages modules that can execute transactions via this contract
/// @author Stefan George - <stefan@gnosis.pm>
/// @author Richard Meissner - <richard@gnosis.pm>
contract ModuleManager is SelfAuthorized, Executor {

    string public constant NAME = "Module Manager";
    string public constant VERSION = "0.0.1";
    address public constant SENTINEL_MODULES = address(0x1);

    mapping (address => address) internal modules;
    
    function setupModules(address to, bytes data)
        internal
    {
        require(modules[SENTINEL_MODULES] == 0, "Modules have already been initialized");
        modules[SENTINEL_MODULES] = SENTINEL_MODULES;
        if (to != 0)
            // Setup has to complete successfully or transaction fails.
            require(executeDelegateCall(to, data, gasleft()), "Could not finish initialization");
    }

    /// @dev Allows to add a module to the whitelist.
    ///      This can only be done via a Safe transaction.
    /// @param module Module to be whitelisted.
    function enableModule(Module module)
        public
        authorized
    {
        // Module address cannot be null or sentinel.
        require(address(module) != 0 && address(module) != SENTINEL_MODULES, "Invalid module address provided");
        // Module cannot be added twice.
        require(modules[module] == 0, "Module has already been added");
        modules[module] = modules[SENTINEL_MODULES];
        modules[SENTINEL_MODULES] = module;
    }

    /// @dev Allows to remove a module from the whitelist.
    ///      This can only be done via a Safe transaction.
    /// @param prevModule Module that pointed to the module to be removed in the linked list
    /// @param module Module to be removed.
    function disableModule(Module prevModule, Module module)
        public
        authorized
    {
        // Validate module address and check that it corresponds to module index.
        require(address(module) != 0 && address(module) != SENTINEL_MODULES, "Invalid module address provided");
        require(modules[prevModule] == address(module), "Invalid prevModule, module pair provided");
        modules[prevModule] = modules[module];
        modules[module] = 0;
    }

    /// @dev Allows a Module to execute a Safe transaction without any further confirmations.
    /// @param to Destination address of module transaction.
    /// @param value Ether value of module transaction.
    /// @param data Data payload of module transaction.
    /// @param operation Operation type of module transaction.
    function execTransactionFromModule(address to, uint256 value, bytes data, Enum.Operation operation)
        public
        returns (bool success)
    {
        // Only whitelisted modules are allowed.
        require(modules[msg.sender] != 0, "Method can only be called from an enabled module");
        // Execute transaction without further confirmations.
        success = execute(to, value, data, operation, gasleft());
    }

    /// @dev Returns array of modules.
    /// @return Array of modules.
    function getModules()
        public
        view
        returns (address[])
    {
        // Calculate module count
        uint256 moduleCount = 0;
        address currentModule = modules[SENTINEL_MODULES];
        while(currentModule != SENTINEL_MODULES) {
            currentModule = modules[currentModule];
            moduleCount ++;
        }
        address[] memory array = new address[](moduleCount);

        // populate return array
        moduleCount = 0;
        currentModule = modules[SENTINEL_MODULES];
        while(currentModule != SENTINEL_MODULES) {
            array[moduleCount] = currentModule;
            currentModule = modules[currentModule];
            moduleCount ++;
        }
        return array;
    }
}
