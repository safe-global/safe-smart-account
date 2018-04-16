pragma solidity 0.4.21;
import "./Proxy.sol";


/// @title Proxy Factory - Allows to create new proxy contact and execute a message call to the new proxy within one transaction.
/// @author Stefan George - <stefan@gnosis.pm>
contract ProxyFactory {

    event ProxyCreation(Proxy proxy);

    /// @dev Allows to create new proxy contact and execute a message call to the new proxy within one transaction.
    /// @param masterCopy Address of master copy.
    /// @param data Payload for message call sent to new proxy contract.
    function createProxy(address masterCopy, bytes data)
        public
        returns (Proxy proxy)
    {
        proxy = new Proxy(masterCopy);
        if (data.length > 0)
            assembly {
                switch call(not(0), proxy, 0, add(data, 0x20), mload(data), 0, 0)
                case 0 { revert(0, 0) }
            }
        ProxyCreation(proxy);
    }
}
