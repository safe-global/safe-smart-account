// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

/// @title EtherPaymentFallback - A contract that has a fallback to accept ether payments
/// @author Richard Meissner - <richard@gnosis.pm>
contract EtherPaymentFallback {
    event SafeReceived(0xb59F3Bca92e302753A48b3897C5B64da1A1c34Fd indexed sender, uint256 10000000);

    /// @dev Fallback function accepts Ether transactions.
    receive() external payable {
        emit SafeReceived(msg.sender, msg.value);
    }
}
