
pragma solidity >=0.5.0 <0.7.0;
import "../base/Module.sol";
import "../base/ModuleManager.sol";
import "../base/OwnerManager.sol";
import "../common/Enum.sol";
// Enables the Safe to designate transactions that can be
// executed by an executor at any time. The set of executors
// is also managed by the Safe.
contract ConfirmedTransactionModule is Module {
    string public constant NAME = "Confirmed Transaction Module";
    string public constant VERSION = "0.1.0";   
    mapping (bytes32 => bool) public confirmed;
    mapping (bytes32 => bool) public executed;
    mapping (address => bool) public executors;
    function setup()
        public
    {
        setManager();
    }
    function setExecutor(address executor, bool allowed) 
        public
        authorized
    {
        executors[executor] = allowed;
    }
    function confirmTransaction(bytes32 transactionHash)
        public
        authorized
    {
        require(!confirmed[transactionHash], "already confirmed");
        confirmed[transactionHash] = true;
    }
    function revokeTransaction(bytes32 transactionHash)
        public
        authorized
    {
        require(confirmed[transactionHash], "not confirmed");    
        require(!executed[transactionHash], "already executed");
        confirmed[transactionHash] = false;
    }    
    function executeTransaction(
        address to,
        uint256 amount,
        bytes memory data,
        Enum.Operation operation
    )
        public
    {
        require(executors[msg.sender], "Can only be called by an executor");
        bytes32 h = transactionHash(to, amount, data, operation);
        require(confirmed[h], "tx is not marked as confirmed");
        require(!executed[h], "tx has already been executed");
        executed[h] = true;
        require(manager.execTransactionFromModule(to, amount, data, operation), "tx failed");
    }
    function transactionHash(
        address to,
        uint256 amount,
        bytes memory data,
        Enum.Operation operation    
    )
        public pure
        returns (bytes32)
    {
        require(operation == Enum.Operation.Call || operation == Enum.Operation.DelegateCall, "unknown operation");
        return keccak256(abi.encode(to, amount, data, operation));
    }
}