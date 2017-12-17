pragma solidity 0.4.19;


contract Proxy {

    address masterCopy;

    function Proxy(address _masterCopy)
        public
    {
        require(_masterCopy != 0);
        masterCopy = _masterCopy;
    }

    function ()
        external
        payable
    {
        assembly {
            let masterCopy := and(sload(0), 0xffffffffffffffffffffffffffffffffffffffff)
            calldatacopy(0, 0, calldatasize())
            let success := delegatecall(not(0), masterCopy, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())
            switch success
            case 0 { revert(0, returndatasize()) }
            default { return(0, returndatasize()) }
        }
    }
}
