pragma solidity ^0.5.3;
import "./GnosisSafeProxy.sol";

interface IProxyCreationCallback {
    function proxyCreated(GnosisSafeProxy proxy, address _mastercopy, bytes calldata initializer, uint256 saltNonce) external;
}
