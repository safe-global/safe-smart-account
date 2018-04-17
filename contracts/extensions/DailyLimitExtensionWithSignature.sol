pragma solidity 0.4.21;
import "./DailyLimitExtension.sol";


/// @title Daily Limit Extension With Signature - Allows to transfer limited amounts of ERC20 tokens and Ether without confirmations.
/// @author Richard Meissner - <richard@gnosis.pm>
contract DailyLimitExtensionWithSignature is DailyLimitExtension {

    uint256 public nonce;

    /// @dev Returns if Safe transaction is a valid daily limit transaction.
    /// @param to Receiver address in case of Ether transfer, token address in case of a token transfer.
    /// @param value Ether value in case of an Ether transfer.
    /// @param data Encoded token transfer. Empty in case of Ether transfer.
    /// @param v Part of the signature of the sender.
    /// @param r Part of the signature of the sender.
    /// @param s Part of the signature of the sender.
    /// @return Returns if transaction can be executed.
    function executeDailyLimitWithSignature(address to, uint256 value, bytes data, uint8 v, bytes32 r, bytes32 s)
        public
    {
        bytes32 transactionHash = getTransactionHash(to, value, data, nonce);
        address sender = ecrecover(transactionHash, v, r, s);
        nonce += 1;
        executeInternal(sender, to, value, data);
    }

    /// @dev Returns transactions hash to be signed by owners.
    /// @param to Destination address.
    /// @param value Ether value.
    /// @param data Data payload.
    /// @param _nonce Transaction nonce.
    /// @return Transaction hash.
    function getTransactionHash(address to, uint256 value, bytes data, uint256 _nonce)
        public
        view
        returns (bytes32)
    {
        return keccak256(byte(0x19), byte(0), this, to, value, data, _nonce);
    }
}
