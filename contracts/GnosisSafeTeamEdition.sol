pragma solidity 0.4.24;
import "./GnosisSafe.sol";
import "./MasterCopy.sol";


/// @title Gnosis Safe Team Edition - A multisignature wallet with support for confirmations.
/// @author Stefan George - <stefan@gnosis.pm>
/// @author Richard Meissner - <richard@gnosis.pm>
contract GnosisSafeTeamEdition is MasterCopy, GnosisSafe {

    string public constant NAME = "Gnosis Safe Team Edition"; 
    string public constant VERSION = "0.0.1";
    //keccak256(
    //    "TeamSafeTx(address to,uint256 value,bytes data,uint8 operation,uint256 nonce)"
    //);
    bytes32 public constant SAFE_TX_TYPEHASH = 0x5d1bba48ff479eb8a88ec6029f6b5eebc805c7dcb87470d5b1121d36d824c873;

    // isExecuted mapping allows to check if a transaction (by hash) was already executed.
    mapping (bytes32 => uint256) public isExecuted;

    // isApproved mapping allows to check if a transaction (by hash) was confirmed by an owner.
    // uint256 is used to optimize the generated assembly. if 0 then false else true
    mapping (bytes32 => mapping(address => uint256)) public isApproved;

    /// @dev Allows to confirm a Safe transaction with a regular transaction.
    ///      This can only be done from an owner address.
    /// @param transactionHash Hash of the Safe transaction.
    function approveTransactionByHash(bytes32 transactionHash)
        public
    {
        // Only Safe owners are allowed to confirm Safe transactions.
        require(owners[msg.sender] != 0, "Sender is not an owner");
        // It should not be possible to confirm an executed transaction
        require(isExecuted[transactionHash] == 0, "Safe transaction already executed");
        isApproved[transactionHash][msg.sender] = 1;
    }

    /// @dev Allows to confirm a Safe transaction with a regular transaction.
    ///      This can only be done from an owner address.
    /// @param to Destination address of Safe transaction.
    /// @param value Ether value of Safe transaction.
    /// @param data Data payload of Safe transaction.
    /// @param operation Operation type of Safe transaction.
    /// @param nonce Nonce used for this Safe transaction.
    function approveTransactionWithParameters(
        address to, 
        uint256 value, 
        bytes data, 
        Enum.Operation operation, 
        uint256 nonce
    )
        public
    {
        approveTransactionByHash(getTransactionHash(to, value, data, operation, nonce));
    }

    /// @dev Allows to execute a Safe transaction confirmed by required number of owners. If the sender is an owner this is automatically confirmed.
    /// @param to Destination address of Safe transaction.
    /// @param value Ether value of Safe transaction.
    /// @param data Data payload of Safe transaction.
    /// @param operation Operation type of Safe transaction.
    /// @param nonce Nonce used for this Safe transaction.
    function execTransactionIfApproved(
        address to, 
        uint256 value, 
        bytes data, 
        Enum.Operation operation, 
        uint256 nonce
    )
        public
    {
        bytes32 transactionHash = getTransactionHash(to, value, data, operation, nonce);
        require(isExecuted[transactionHash] == 0, "Safe transaction already executed");
        checkAndClearConfirmations(transactionHash);
        // Mark as executed and execute transaction.
        isExecuted[transactionHash] = 1;
        require(execute(to, value, data, operation, gasleft()), "Could not execute safe transaction");
    }

    function checkAndClearConfirmations(bytes32 transactionHash)
        internal
    {
        mapping(address => uint256) approvals = isApproved[transactionHash];
        uint256 confirmations = 0;
        // Validate threshold is reached.
        address currentOwner = owners[SENTINEL_OWNERS];
        while (currentOwner != SENTINEL_OWNERS) {
            bool ownerConfirmed = approvals[currentOwner] != 0;
            if(currentOwner == msg.sender || ownerConfirmed) {
                if (ownerConfirmed) {
                    approvals[currentOwner] = 0;
                }
                confirmations ++;
            }
            currentOwner = owners[currentOwner];
        }
        require(confirmations >= threshold, "Not enough confirmations");
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
        bytes32 safeTxHash = keccak256(
            abi.encode(SAFE_TX_TYPEHASH, to, value, keccak256(data), operation, nonce)
        );
        return keccak256(
            abi.encodePacked(byte(0x19), byte(1), this, safeTxHash)
        );
    }
}
