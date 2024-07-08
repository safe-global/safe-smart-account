// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;
import "./Executor.sol";

contract ExecutorExternal is Executor {
    function externalExecute(address to, uint256 value, bytes memory data, Enum.Operation operation, uint256 txGas) external {
        bool success = execute(to, value, data, operation, txGas);
        assembly {
            let ptr := mload(0x40)
            mstore(ptr, success)
            revert(ptr, 0x20)
        }
    }
}
