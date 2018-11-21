pragma solidity ^0.5.0;


/// @title Multi Send - Allows to batch multiple transactions into one.
/// @author Nick Dodson - <nick.dodson@consensys.net>
/// @author Gonçalo Sá - <goncalo.sa@consensys.net>
/// @author Stefan George - <stefan@gnosis.pm>
contract MultiSend {

    /// @dev Sends multiple transactions and reverts all if one fails.
    /// @param transactions Encoded transactions. Each transaction is encoded as a 
    ///                     tuple(operation,address,uint256,bytes), where operation 
    ///                     can be 0 for a call or 1 for a delegatecall. The bytes 
    ///                     of all encoded transactions are concatenated to form the input.
    function multiSend(bytes memory transactions)
        public
    {
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            let length := mload(transactions)
            let i := 0x20
            for { } lt(i, length) { } {
                let operation := mload(add(transactions, i))
                let to := mload(add(transactions, add(i, 0x20)))
                let value := mload(add(transactions, add(i, 0x40)))
                let dataLength := mload(add(transactions, add(i, 0x80)))
                let data := add(transactions, add(i, 0xa0))
                let success := 0
                switch operation 
                case 0 { success := call(gas, to, value, data, dataLength, 0, 0) }
                case 1 { success := delegatecall(gas, to, data, dataLength, 0, 0) }
                if eq(success, 0) { revert(0, 0) }
                i := add(i, add(0xa0, mul(div(add(dataLength, 0x1f), 0x20), 0x20)))
            }
        }
    }
}
