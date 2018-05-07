pragma solidity 0.4.23;
import "./Module.sol";
import "./MasterCopy.sol";
import "./Enum.sol";


/// @title Module Manager - A contract that manages modules that can execute transactions via this contract
/// @author Stefan George - <stefan@gnosis.pm>
/// @author Richard Meissner - <richard@gnosis.pm>
contract ModuleManager is MasterCopy {

    event ContractCreation(address newContract);

    string public constant NAME = "Module Manager";
    string public constant VERSION = "0.0.1";

    Module[] public modules;

    // isModule mapping allows to check if a module was whitelisted.
    mapping (address => bool) public isModule;

    bool initialized;

    /// @dev Fallback function accepts Ether transactions.
    function ()
        external
        payable
    {

    }

    function setupModules(address to, bytes data)
        public
    {
        require(!initialized);
        initialized = true;
        if (to != 0)
            // Setup has to complete successfully or transaction fails.
            require(executeDelegateCall(to, data, gasleft()));
    }

    /// @dev Allows to add a module to the whitelist.
    ///      This can only be done via a Safe transaction.
    /// @param module Module to be whitelisted.
    function addModule(Module module)
        public
        authorized
    {
        // Module address cannot be null.
        require(address(module) != 0);
        // Module cannot be added twice.
        require(!isModule[module]);
        modules.push(module);
        isModule[module] = true;
    }

    /// @dev Allows to remove a module from the whitelist.
    ///      This can only be done via a Safe transaction.
    /// @param moduleIndex Array index position of module to be removed from whitelist.
    /// @param module Module to be removed.
    function removeModule(uint256 moduleIndex, Module module)
        public
        authorized
    {
        // Validate module address corresponds to module index.
        require(modules[moduleIndex] == module);
        isModule[module] = false;
        modules[moduleIndex] = modules[modules.length - 1];
        modules.length--;
    }

    /// @dev Allows a Module to execute a Safe transaction without any further confirmations.
    /// @param to Destination address of module transaction.
    /// @param value Ether value of module transaction.
    /// @param data Data payload of module transaction.
    /// @param operation Operation type of module transaction.
    function executeModule(address to, uint256 value, bytes data, Enum.Operation operation)
        public
        returns (bool success)
    {
        // Only whitelisted modules are allowed.
        require(isModule[msg.sender]);
        // Execute transaction without further confirmations.
        success = execute(to, value, data, operation, gasleft());
    }

    function execute(address to, uint256 value, bytes data, Enum.Operation operation, uint256 txGas)
        internal
        returns (bool success)
    {
        if (operation == Enum.Operation.Call)
            success = executeCall(to, value, data, txGas);
        else if (operation == Enum.Operation.DelegateCall)
            success = executeDelegateCall(to, data, txGas);
        else {
            address newContract = executeCreate(data);
            success = newContract != 0;
            emit ContractCreation(newContract);
        }
    }

    function executeCall(address to, uint256 value, bytes data, uint256 txGas)
        internal
        returns (bool success)
    {
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            success := call(txGas, to, value, add(data, 0x20), mload(data), 0, 0)
        }
    }

    function executeDelegateCall(address to, bytes data, uint256 txGas)
        internal
        returns (bool success)
    {
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            success := delegatecall(txGas, to, add(data, 0x20), mload(data), 0, 0)
        }
    }

    function executeCreate(bytes data)
        internal
        returns (address newContract)
    {
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            newContract := create(0, add(data, 0x20), mload(data))
        }
    }

    /// @dev Returns array of modules.
    /// @return Array of modules.
    function getModules()
        public
        view
        returns (Module[])
    {
        return modules;
    }
}
