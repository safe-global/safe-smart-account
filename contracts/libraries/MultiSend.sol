pragma solidity 0.4.19;


contract MultiSend {

    function multiSend(bytes transactions)
        public
    {
        assembly {
            let length := mload(transactions)
            let i := 0x20
            for { } lt(i, length) { } {
                let to := mload(add(transactions, i))
                let value := mload(add(transactions, add(i, 0x20)))
                let dataLength := mload(add(transactions, add(i, 0x40)))
                let data := add(transactions, add(i, 0x60))
                switch call(not(0), to, value, data, dataLength, 0, 0)
                case 0 { revert(0, 0) }
                i := add(i, add(0x40, dataLength))
            }
        }
    }
}
