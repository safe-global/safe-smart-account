// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import "../base/GuardManager.sol";
import "../GnosisSafe.sol";

contract DelegateCallTransactionGuard is Guard {

    address immutable public allowedTarget;

    constructor(address target) {
        allowedTarget = target;
    }

    fallback() external {
        // We only check known calls
    }

    function dataSelector(bytes calldata _bytes)
        internal
        pure
        returns (bytes4 selector)
    {
        selector =
            _bytes[0] |
            (bytes4(_bytes[1]) >> 8) |
            (bytes4(_bytes[2]) >> 16) |
            (bytes4(_bytes[3]) >> 24);
    }

    function checkCalldata(bytes calldata data, address) override view external {
        // We only check known calls
        if (data.length < 4 || dataSelector(data[:4]) != GnosisSafe.execTransaction.selector) return;
        address to;
        uint8 operation;
        (to,,,operation,,,,,,) = abi.decode(data[4:], (address,uint256,bytes,uint8,int256,uint256,uint256,address,address,bytes));
        require(operation != 1 || to == allowedTarget, "This call is restricted");
    }
}