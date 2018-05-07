pragma solidity 0.4.23;
import "./GnosisSafe.sol";
import "./MasterCopy.sol";


/// @title Gnosis Safe Team Edition - A multisignature wallet with support for confirmations.
/// @author Stefan George - <stefan@gnosis.pm>
/// @author Richard Meissner - <richard@gnosis.pm>
contract GnosisSafeTeamEdition is MasterCopy, GnosisSafe {

    string public constant NAME = "Gnosis Safe Team Edition";
    string public constant VERSION = "0.0.1";

    // isExecuted mapping allows to check if a transaction (by hash) was already executed.
    mapping (bytes32 => bool) public isExecuted;

    // isConfirmed mapping allows to check if a transaction (by hash) was confirmed by an owner.
    mapping (bytes32 => mapping(address => bool)) public isConfirmed;

    /// @dev Allows to confirm a Safe transaction with a regular transaction.
    ///      This can only be done from an owner address.
    /// @param to Destination address.
    /// @param value Ether value.
    /// @param data Data payload.
    /// @param operation Operation type.
    /// @param nonce Transaction nonce.
    function confirmTransaction(address to, uint256 value, bytes data, Enum.Operation operation, uint256 nonce)
        public
    {
        // Only Safe owners are allowed to confirm Safe transactions.
        require(isOwner[msg.sender]);
        bytes32 transactionHash = getTransactionHash(to, value, data, operation, nonce);
        // It is only possible to confirm a transaction once.
        require(!isConfirmed[transactionHash][msg.sender]);
        isConfirmed[transactionHash][msg.sender] = true;
    }

    /// @dev Allows to execute a Safe transaction confirmed by required number of owners.
    /// @param to Destination address of Safe transaction.
    /// @param value Ether value of Safe transaction.
    /// @param data Data payload of Safe transaction.
    /// @param operation Operation type of Safe transaction.
    /// @param nonce Nonce used for this Safe transaction.
    function executeTransaction(
        address to, 
        uint256 value, 
        bytes data, 
        Enum.Operation operation, 
        uint256 nonce
    )
        public
    {
        bytes32 transactionHash = getTransactionHash(to, value, data, operation, nonce);
        require(!isExecuted[transactionHash]);
        checkAndClearConfirmations(transactionHash);
        // Mark as executed and execute transaction.
        isExecuted[transactionHash] = true;
        require(execute(to, value, data, operation, gasleft()));
    }

    function checkAndClearConfirmations(bytes32 transactionHash)
        internal
    {
        uint256 confirmations = 0;
        // Validate threshold is reached.
        for (uint256 i = 0; i < owners.length; i++) {
            address owner = owners[i];
            bool ownerConfirmed = isConfirmed[transactionHash][owner];
            if(owner == msg.sender || ownerConfirmed) {
                if (ownerConfirmed) {
                    isConfirmed[transactionHash][owner] = false;
                }
                confirmations ++;
            }
        }
        require(confirmations >= threshold);
    }

    /// @dev Returns hash to be signed by owners.
    /// @param to Destination address.
    /// @param value Ether value.
    /// @param data Data payload.
    /// @param operation Operation type.
    /// @param nonce Transaction nonce.
    /// @return Transaction hash.
    function getTransactionHash(
        address to, 
        uint256 value, 
        bytes data, 
        Enum.Operation operation, 
        uint256 nonce
    )
        public
        view
        returns (bytes32)
    {
        return keccak256(byte(0x19), byte(0), this, to, value, data, operation, nonce);
    }
}
