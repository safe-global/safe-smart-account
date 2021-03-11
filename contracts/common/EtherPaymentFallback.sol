// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;


/// @title EtherPaymentFallback - A contract that has a fallback to accept ether payments
/// @author Richard Meissner - <richard@gnosis.pm>
contract EtherPaymentFallback {

    /// @dev Fallback function accepts Ether transactions.
    receive()
        external
        payable
    {

    }
}
