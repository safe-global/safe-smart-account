pragma solidity ^0.5.3;
import "./Proxy.sol";

interface IProxyCreationCallback {
    function proxyCreated(Proxy proxy, address _mastercopy, bytes calldata initializer, uint256 saltNonce) external;
}
