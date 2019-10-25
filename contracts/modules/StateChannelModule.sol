pragma solidity >=0.5.0 <0.7.0;
import "../base/Module.sol";
import "../base/OwnerManager.sol";
import "../common/Enum.sol";
import "../common/SignatureDecoder.sol";


/// @title Gnosis Safe State Module - A module that allows interaction with statechannels.
/// @author Stefan George - <stefan@gnosis.pm>
/// @author Richard Meissner - <richard@gnosis.pm>
contract StateChannelModule is Module, SignatureDecoder {

    string public constant NAME = "State Channel Module";
    string public constant VERSION = "0.1.0";

    // isExecuted mapping allows to check if a transaction (by hash) was already executed.
    mapping (bytes32 => uint256) public isExecuted;

    /// @dev Setup function sets manager
    function setup()
        public
    {
        setManager();
    }

    /// @dev Allows to execute a Safe transaction confirmed by required number of owners.
    /// @param to Destination address of Safe transaction.
    /// @param value Ether value of Safe transaction.
    /// @param data Data payload of Safe transaction.
    /// @param operation Operation type of Safe transaction.
    /// @param nonce Nonce used for this Safe transaction.
    /// @param signatures Packed signature data ({bytes32 r}{bytes32 s}{uint8 v})
    function execTransaction(
        address to,
        uint256 value,
        bytes memory data,
        Enum.Operation operation,
        uint256 nonce,
        bytes memory signatures
    )
        public
    {
        bytes32 transactionHash = getTransactionHash(to, value, data, operation, nonce);
        require(isExecuted[transactionHash] == 0, "Transaction already executed");
        checkHash(transactionHash, signatures);
        // Mark as executed and execute transaction.
        isExecuted[transactionHash] = 1;
        require(manager.execTransactionFromModule(to, value, data, operation), "Could not execute transaction");
    }

    function checkHash(bytes32 transactionHash, bytes memory signatures)
        internal
        view
    {
        // There cannot be an owner with address 0.
        address lastOwner = address(0);
        address currentOwner;
        uint256 i;
        uint256 threshold = OwnerManager(address(manager)).getThreshold();
        // Validate threshold is reached.
        for (i = 0; i < threshold; i++) {
            currentOwner = recoverKey(transactionHash, signatures, i);
            require(OwnerManager(address(manager)).isOwner(currentOwner), "Signature not provided by owner");
            require(currentOwner > lastOwner, "Signatures are not ordered by owner address");
            lastOwner = currentOwner;
        }
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
        bytes memory data,
        Enum.Operation operation,
        uint256 nonce
    )
        public
        view
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(byte(0x19), byte(0), this, to, value, data, operation, nonce));
    }
}
