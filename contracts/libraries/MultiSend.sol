pragma solidity 0.4.23;


/// @title Multi Send - Allows to batch multiple transactions into one.
/// @author Nick Dodson - <nick.dodson@consensys.net>
/// @author Gonçalo Sá - <goncalo.sa@consensys.net>
/// @author Stefan George - <stefan@gnosis.pm>
contract MultiSend {

    /// @dev Sends multiple transactions and reverts all if one fails.
    /// @param transactions Encoded transactions. Each transaction is encoded as
    ///                     a tuple(address,uint256,bytes). The bytes of all
    ///                     encoded transactions are concatenated to form the input.
    function multiSend(bytes transactions)
        public
    {
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            let length := mload(transactions)
            let i := 0x20
            for { } lt(i, length) { } {
                let to := mload(add(transactions, i))
                let value := mload(add(transactions, add(i, 0x20)))
                let dataLength := mload(add(transactions, add(i, 0x60)))
                let data := add(transactions, add(i, 0x80))
                switch call(gas, to, value, data, dataLength, 0, 0)
                case 0 { revert(0, 0) }
                i := add(i, add(0x80, mul(div(add(dataLength, 0x1f), 0x20), 0x20)))
            }
        }
    }
}
