pragma solidity ^0.4.24;


/// @title EtherPaymentFallback - A contract that has a fallback to accept ether payments
/// @author Richard Meissner - <richard@gnosis.pm>
contract EtherPaymentFallback {

    /// @dev Fallback function accepts Ether transactions.
    function ()
        external
        payable
    {

    }
}
