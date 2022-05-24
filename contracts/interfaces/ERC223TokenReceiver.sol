// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

interface ERC223TokenReceiver {
    /*
        @notice Handle the receipt of a single ERC223 token type.       
        @param _from      The address which previously owned the token
        @param _value     The amount of tokens being transferred
        @param _data      Additional data with no specified format
    */
    function tokenFallback(
        address _from,
        uint256 _value,
        bytes calldata _data
    ) external;
}
