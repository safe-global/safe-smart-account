// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

/**
 * @title TestHandler - A test FallbackHandler contract
 */
contract Delegatecaller {
    /**
     * @notice makes a delegatecall
     * @param _called The address to be delegate called
     * @param _calldata the calldata of the call
     */
    function makeDelegatecal(address _called, bytes memory _calldata) external returns (bool success, bytes memory returndata) {
        (success, returndata) = _called.delegatecall(_calldata);
    }
}
