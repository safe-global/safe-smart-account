// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

/**
 * @title Native Currency Payment Fallback
 * @notice A contract that has a fallback to accept native token payments.
 * @author Richard Meissner - @rmeissner
 */
abstract contract NativeCurrencyPaymentFallback {
    /**
     * @notice Native tokens were received.
     * @param sender The address that sent the tokens.
     * @param value The native token value that was received.
     */
    event SafeReceived(address indexed sender, uint256 value);

    /**
     * @notice Receive function that accepts native token transactions.
     * @dev Emits an event with sender and received value.
     */
    receive() external payable {
        emit SafeReceived(msg.sender, msg.value);
    }
}
