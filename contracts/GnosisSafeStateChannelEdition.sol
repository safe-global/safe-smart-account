pragma solidity 0.4.23;
import "./GnosisSafe.sol";
import "./MasterCopy.sol";


/// @title Gnosis Safe State Channel Edition - A multisignature wallet with support for confirmations.
/// @author Stefan George - <stefan@gnosis.pm>
/// @author Richard Meissner - <richard@gnosis.pm>
contract GnosisSafeStateChannelEdition is MasterCopy, GnosisSafe {

    string public constant NAME = "Gnosis Safe State Channel Edition";
    string public constant VERSION = "0.0.1";

    // isExecuted mapping allows to check if a transaction (by hash) was already executed.
    mapping (bytes32 => bool) public isExecuted;

    /// @dev Allows to execute a Safe transaction confirmed by required number of owners.
    /// @param to Destination address of Safe transaction.
    /// @param value Ether value of Safe transaction.
    /// @param data Data payload of Safe transaction.
    /// @param operation Operation type of Safe transaction.
    /// @param nonce Nonce used for this Safe transaction.
    /// @param v Array of signature V values sorted by owner addresses.
    /// @param r Array of signature R values sorted by owner addresses.
    /// @param s Array of signature S values sorted by owner addresses.
    function execTransaction(
        address to, 
        uint256 value, 
        bytes data, 
        Enum.Operation operation, 
        uint256 nonce,
        uint8[] v, 
        bytes32[] r, 
        bytes32[] s
    )
        public
    {
        bytes32 transactionHash = getTransactionHash(to, value, data, operation, nonce);
        require(!isExecuted[transactionHash]);
        checkHash(transactionHash, v, r, s);
        // Mark as executed and execute transaction.
        isExecuted[transactionHash] = true;
        require(execute(to, value, data, operation, gasleft()));
    }

    function checkHash(bytes32 transactionHash, uint8[] v, bytes32[] r, bytes32[] s)
        internal
        view
    {
        // There cannot be an owner with address 0.
        address lastOwner = address(0);
        address currentOwner;
        uint256 i;
        // Validate threshold is reached.
        for (i = 0; i < threshold; i++) {
            currentOwner = ecrecover(transactionHash, v[i], r[i], s[i]);
            require(owners[currentOwner] != 0);
            require(currentOwner > lastOwner);
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
