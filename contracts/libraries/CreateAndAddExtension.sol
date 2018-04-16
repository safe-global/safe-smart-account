pragma solidity 0.4.21;
import "../Extension.sol";


/// @title Create and Add Extension - Allows to create and add a new extension in one transaction.
/// @author Stefan George - <stefan@gnosis.pm>
contract CreateAndAddExtension {

    /// @dev Function required to compile contract. Gnosis Safe function is called instead.
    /// @param extension Not used.
    function addExtension(Extension extension)
        public
    {
        revert();
    }

    /// @dev Allows to create and add a new extension in one transaction.
    /// @param proxyFactory Extension factory contract.
    /// @param data Extension constructor payload.
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
        assembly {
            let output := mload(0x40)
            switch delegatecall(not(0), proxyFactory, add(data, 0x20), mload(data), output, 0x20)
            case 0 { revert(0, 0) }
            extension := and(mload(output), 0xffffffffffffffffffffffffffffffffffffffff)
        }
    }
}
