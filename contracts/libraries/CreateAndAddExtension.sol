pragma solidity 0.4.19;
import "../Extension.sol";


contract CreateAndAddExtension {

    function addExtension(Extension extension)
        public
    {
        revert();
    }

    function createAndAddExtension(address proxyFactory, bytes data)
        public
    {
        Extension extension = createExtension(proxyFactory, data);
        this.addExtension(extension);
    }

    function createExtension(address proxyFactory, bytes data)
        internal
        returns (Extension extension)
    {
        // Create extension
        assembly {
            let output := mload(0x40)
            switch delegatecall(not(0), proxyFactory, add(data, 0x20), mload(data), output, 0x20)
            case 0 { revert(0, 0) }
            extension := and(mload(output), 0xffffffffffffffffffffffffffffffffffffffff)
        }
    }
}
