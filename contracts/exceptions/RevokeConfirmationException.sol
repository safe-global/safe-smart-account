pragma solidity 0.4.17;
import "../Exception.sol";
import "../GnosisSafe.sol";


contract RevokeConfirmationException is Exception {

    event Revocation(address indexed owner, bytes32 transactionHash);

    string public constant NAME = "Revoke Confirmation Exception";
    string public constant VERSION = "0.0.1";

    uint8 public required;
    Condition public condition;
    address[] public owners;
    Exception[] public exceptions;
    mapping (address => bool) public isOwner;
    mapping (address => bool) public isException;
    mapping (bytes32 => bool) public isExecuted;
    mapping (bytes32 => mapping (address => bool)) public isConfirmed;
    GnosisSafe public gnosisSafe;

    function RevokeConfirmationException()
        public
    {
        gnosisSafe = GnosisSafe(msg.sender);
    }

    function revokeConfirmation(bytes32 transactionHash)
        public
    {
        require(   !isExecuted[transactionHash]
                && isConfirmed[transactionHash][msg.sender]);
        isConfirmed[transactionHash][msg.sender] = false;
        Revocation(msg.sender, transactionHash);
    }

    function isExecutable(address sender, address to, uint value, bytes data, GnosisSafe.Operation operation)
        public
        returns (bool)
    {
        require(   operation == GnosisSafe.Operation.DelegateCall
                && gnosisSafe.isOwner(sender)
                && to == address(this)
                && value == 0);
        /*bytes4 functionIdentifier;
        assembly {
            functionIdentifier := mload(add(data, 32))
        }
        if (functionIdentifier == revokeConfirmation.sign)
            return true;
        return false;*/
        return true;
    }
}
