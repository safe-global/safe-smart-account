// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import "../common/Enum.sol";
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

    function checkTransaction(
        address to,
        uint256,
        bytes memory,
        Enum.Operation operation,
        uint256,
        uint256,
        uint256,
        address,
        address payable,
        bytes memory,
        address
    ) override external view {
        require(operation != Enum.Operation.DelegateCall || to == allowedTarget, "This call is restricted");
    }
}