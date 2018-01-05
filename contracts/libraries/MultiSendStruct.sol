pragma solidity ^0.4.19;
pragma experimental ABIEncoderV2;


/// @title Multi Send - Allows to batch multiple transactions into one.
/// @author Nick Dodson - <nick.dodson@consensys.net>
/// @author Gonçalo Sá - <goncalo.sa@consensys.net>
/// @author Stefan George - <stefan@gnosis.pm>
/// @author Richard Meissner - <richard@gnosis.pm>
contract MultiSendStruct {

    struct Tx {
      address to;
      uint256 value;
      bytes data;
    }

    /// @dev Sends multiple transactions and reverts all if one fails.
    /// @param transactions Encoded transactions.
    function multiSend(Tx[] transactions)
        public
    {
        for(uint i = 0; i < transactions.length; i++) {
            Tx memory transaction = transactions[i];
            require(executeCall(transaction.to, transaction.value, transaction.data));
        }
    }

    function executeCall(address to, uint256 value, bytes data)
        internal
        returns (bool success)
    {
        assembly {
            success := call(not(0), to, value, add(data, 0x20), mload(data), 0, 0)
        }
    }
}
