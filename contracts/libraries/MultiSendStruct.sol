pragma solidity ^0.4.23;
pragma experimental ABIEncoderV2;


/// @title Multi Send - Allows to batch multiple transactions into one.
/// @author Nick Dodson - <nick.dodson@consensys.net>
/// @author Gonçalo Sá - <goncalo.sa@consensys.net>
/// @author Stefan George - <stefan@gnosis.pm>
/// @author Richard Meissner - <richard@gnosis.pm>
contract MultiSendStruct {

    struct Transaction {
        address to;
        uint256 value;
        bytes data;
    }

    /// @dev Sends multiple transactions and reverts all if one fails.
    /// @param transactions Encoded transactions.
    function multiSend(Transaction[] transactions)
        public
    {
        for(uint256 i = 0; i < transactions.length; i++) {
            Transaction memory transaction = transactions[i];
            require(executeCall(transaction.to, transaction.value, transaction.data));
        }
    }

    function executeCall(address to, uint256 value, bytes data)
        internal
        returns (bool success)
    {
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            success := call(gas, to, value, add(data, 0x20), mload(data), 0, 0)
        }
    }
}
