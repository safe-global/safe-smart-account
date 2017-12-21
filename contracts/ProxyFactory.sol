pragma solidity 0.4.19;
import "./Proxy.sol";


contract ProxyFactory {
    
    event ProxyCreation(Proxy proxy);

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
