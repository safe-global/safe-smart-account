pragma solidity 0.4.19;
import "../Extension.sol";


contract CreateAndAddExtension {

    function addExtension(Extension extension)
        public
    {
        revert();
    }

    function createAndAddExtension(address proxyFactory, bytes extensionData)
        public
    {
        Extension extension = createExtension(proxyFactory, extensionData);
        this.addExtension(extension);
    }

    function createExtension(address proxyFactory, bytes extensionData)
        internal
        returns (Extension extension)
    {
        // Create extension
        bool success;
        uint256 extensionDataLength = extensionData.length;
        assembly {
            let output := mload(0x40)
            success := delegatecall(
                not(0),
                proxyFactory,
                add(extensionData, 32),
                extensionDataLength,
                output,
                32
            )
            extension := and(mload(output), 0xffffffffffffffffffffffffffffffffffffffff)
        }
        require(success);
    }
}
