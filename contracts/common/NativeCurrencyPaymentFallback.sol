// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import {INativeCurrencyPaymentFallback} from "./../interfaces/INativeCurrencyPaymentFallback.sol";

/**
 * @title NativeCurrencyPaymentFallback - A contract that has a fallback to accept native currency payments.
 * @author Richard Meissner - @rmeissner
 */
abstract contract NativeCurrencyPaymentFallback is INativeCurrencyPaymentFallback {
    /**
     * @inheritdoc INativeCurrencyPaymentFallback
     */
    receive() external payable override {
        emit SafeReceived(msg.sender, msg.value);
    }
}
