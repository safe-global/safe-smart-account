// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

/**
 * @title ERC-777 Tokens Recipient Interface
 * @dev Interface for contracts that will be called with the ERC-777 token's `tokensReceived` method.
 *      The contract receiving the tokens must implement this interface to receive the tokens.
 */
interface ERC777TokensRecipient {
    /**
     * @dev Called by the ERC-777 token contract after a successful transfer or a minting operation.
     * @param operator The address of the operator performing the transfer or minting operation.
     * @param from The address of the sender.
     * @param to The address of the recipient.
     * @param amount The amount of tokens that were transferred or minted.
     * @param data Additional data that was passed during the transfer or minting operation.
     * @param operatorData Additional data that was passed by the operator during the transfer or minting operation.
     */
    function tokensReceived(
        address operator,
        address from,
        address to,
        uint256 amount,
        bytes calldata data,
        bytes calldata operatorData
    ) external;
}
