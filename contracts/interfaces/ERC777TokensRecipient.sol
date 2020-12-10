// SPDX-License-Identifier: LGPL-3.0-or-later
pragma solidity >=0.6.0 <0.8.0;

interface ERC777TokensRecipient {
    function tokensReceived(
        address operator,
        address from,
        address to,
        uint256 amount,
        bytes calldata data,
        bytes calldata operatorData
    ) external;
}