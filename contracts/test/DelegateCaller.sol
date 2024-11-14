// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

/**
 * @title DelegateCaller - A test contract that executes delegatecalls
 */
contract DelegateCaller {
    /**
     * @notice makes a delegatecall
     * @param _called The address to be delegate called
     * @param _calldata the calldata of the call
     */
    function makeDelegatecall(address _called, bytes memory _calldata) external returns (bool success, bytes memory returnData) {
        (success, returnData) = _called.delegatecall(_calldata);
        if (!success) {
            /* solhint-disable no-inline-assembly */
            /// @solidity memory-safe-assembly
            assembly {
                let ptr := mload(0x40)
                returndatacopy(ptr, 0, returndatasize())
                revert(ptr, returndatasize())
            }
            /* solhint-enable no-inline-assembly */
        }
    }
}
