// SPDX-License-Identifier: LGPL-3.0-or-later
pragma solidity >=0.6.0 <0.8.0;
import "./GnosisSafeProxy.sol";

interface IProxyCreationCallback {
    function proxyCreated(GnosisSafeProxy proxy, address _mastercopy, bytes calldata initializer, uint256 saltNonce) external;
}
