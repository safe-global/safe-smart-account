
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
    mapping (address => mapping (bytes32 => bool)) public confirmed;
    mapping (bytes32 => bool) public executed;
    OwnerManager safe;

    function setup(OwnerManager _safe)
        public
    {
        setManager();
        safe = _safe;
    }

    function confirmTransaction(bytes32 txHash)
        public
    {
        require(OwnerManager(safe).isOwner(msg.sender), "Method can only be called by an owner");
        require(!confirmed[msg.sender][txHash], "already confirmed");
        confirmed[msg.sender][txHash] = true;
    }
    function revokeTransaction(bytes32 txHash)
        public
        authorized
    {
        require(OwnerManager(safe).isOwner(msg.sender), "Method can only be called by an owner");
        require(confirmed[msg.sender][txHash], "not confirmed");    
        require(!executed[txHash], "already executed");
        confirmed[msg.sender][txHash] = false;
    }    
    function executeTransaction(
        address to,
        uint256 amount,
        bytes memory data,
        Enum.Operation operation
    )
        public
    {
        require(safe.isOwner(msg.sender), "Method can only be called by an owner");
        bytes32 h = transactionHash(to, amount, data, operation);
        uint treshold = safe.getThreshold();
        require(getConfirmations(h) >= treshold, "Insufficient number of confirmations");
        require(!executed[h], "tx has already been executed");
        executed[h] = true;
        require(manager.execTransactionFromModule(to, amount, data, operation), "tx failed");
    }

    // Require number of confirmations for h to be >= treshold
    function getConfirmations(bytes32 txHash) internal view returns (uint) {
        address[] memory owners = safe.getOwners();
        uint confirmations = 0;
        for (uint i=0; i< owners.length; i++) {
            if (confirmed[msg.sender][txHash]) {
                confirmations += 1;
            }
        }
        return confirmations;
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