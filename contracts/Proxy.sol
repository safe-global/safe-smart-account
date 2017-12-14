pragma solidity 0.4.19;


contract Proxy {

    address destination;

    function Proxy(address _destination)
        public
    {
        require(_destination != 0);
        destination = _destination;
    }

    function ()
        external
        payable
    {
        assembly {
            let destination := and(sload(0), 0xffffffffffffffffffffffffffffffffffffffff)
            calldatacopy(0, 0, calldatasize())
            let success := delegatecall(not(0), destination, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())
            switch success
            case 0 { revert(0, returndatasize()) }
            default { return(0, returndatasize()) }
        }
    }
}
