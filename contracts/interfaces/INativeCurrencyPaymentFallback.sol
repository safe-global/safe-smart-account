// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

/**
 * @title Native Currency Payment Fallback Interface
 * @notice An interface to a contract that can receive native currency payments.
 * @author @safe-global/safe-protocol
 */
interface INativeCurrencyPaymentFallback {
    event SafeReceived(address indexed sender, uint256 value);

    /**
     * @notice Receive function accepts native currency transactions.
     * @dev Emits an event with sender and received value.
     */
    receive() external payable;
}
