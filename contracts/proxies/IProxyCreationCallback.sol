// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.8.0;
import "./GnosisSafeProxy.sol";

interface IProxyCreationCallback {
    function proxyCreated(GnosisSafeProxy proxy, address _mastercopy, bytes calldata initializer, uint256 saltNonce) external;
}
