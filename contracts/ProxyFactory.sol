pragma solidity 0.4.19;
import "./Proxy.sol";


contract ProxyFactory {
    
    event ProxyCreation(Proxy proxy);

    function createProxy(address masterCopy, bytes data)
        public
        returns (Proxy proxy)
    {
        proxy = new Proxy(masterCopy);
        if (data.length > 0) {
            bool success;
            uint256 dataLength = data.length;
            assembly {
                success := call(
                    not(0),
                    proxy,
                    0,
                    add(data, 32),
                    dataLength,
                    0,
                    0
                )
            }
            require(success);
        }
        ProxyCreation(proxy);
    }
}
